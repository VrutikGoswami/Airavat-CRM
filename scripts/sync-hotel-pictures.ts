import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "hotel-media";
const APPLY = process.argv.includes("--apply");
const rootArg = process.argv.find((arg) => arg.startsWith("--pictures-root="));
const picturesRoot = path.resolve(rootArg?.split("=").slice(1).join("=") || "../Hotel Pictures");

type HotelRow = {
  id: string;
  slug: string;
  name: string;
  destination_slug: string;
  destination_name: string;
  image_urls: string[] | null;
};

function loadLocalEnv() {
  const envPath = path.resolve(".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hotelFolders() {
  return readdirSync(picturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((destination) => {
      const destinationPath = path.join(picturesRoot, destination.name);
      return readdirSync(destinationPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((hotel) => ({
          destinationName: destination.name,
          destinationSlug: slugify(destination.name),
          hotelName: hotel.name,
          hotelSlug: slugify(`${hotel.name}-${destination.name}`),
          files: readdirSync(path.join(destinationPath, hotel.name), { withFileTypes: true })
            .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".png")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => path.join(destinationPath, hotel.name, entry.name)),
        }));
    })
    .filter((hotel) => hotel.files.length > 0);
}

async function main() {
  loadLocalEnv();
  if (!existsSync(picturesRoot)) throw new Error(`Hotel pictures folder not found: ${picturesRoot}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

  const folders = hotelFolders();
  console.log(JSON.stringify({ picturesRoot, hotels: folders.map((hotel) => ({ destination: hotel.destinationName, hotel: hotel.hotelName, pngs: hotel.files.length })) }, null, 2));
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to upload images and update hotel records.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) throw bucketListError;
  if (buckets.some((bucket) => bucket.id === BUCKET)) {
    const { error } = await supabase.storage.updateBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (error) throw error;
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (error) throw error;
  }

  const { data: hotelData, error: hotelsError } = await supabase
    .from("rate_hotels")
    .select("id,slug,name,destination_slug,destination_name,image_urls");
  if (hotelsError) throw hotelsError;
  const hotels = (hotelData ?? []) as HotelRow[];
  const updated: Array<{ hotel: string; destination: string; images: number; created: boolean }> = [];

  for (const folder of folders) {
    let hotel = hotels.find((row) =>
      slugify(row.name) === slugify(folder.hotelName)
      && row.destination_slug === folder.destinationSlug,
    );
    let created = false;
    if (!hotel) {
      const { data, error } = await supabase.from("rate_hotels").insert({
        slug: folder.hotelSlug,
        name: folder.hotelName,
        destination_slug: folder.destinationSlug,
        destination_name: folder.destinationName,
        city: folder.destinationName === "Nairobi" ? "Nairobi" : null,
        country: "Kenya",
        active: true,
        image_urls: [],
      }).select("id,slug,name,destination_slug,destination_name,image_urls").single();
      if (error || !data) throw error || new Error(`Could not create ${folder.hotelName}`);
      hotel = data as HotelRow;
      hotels.push(hotel);
      created = true;
    }

    const uploadedUrls: string[] = [];
    for (const filePath of folder.files) {
      const storagePath = `${folder.destinationSlug}/${folder.hotelSlug}/${slugify(path.basename(filePath, path.extname(filePath)))}.png`;
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, readFileSync(filePath), {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw error;
      uploadedUrls.push(supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl);
    }

    const existingExternal = (hotel.image_urls ?? []).filter((imageUrl) => !imageUrl.includes(`/storage/v1/object/public/${BUCKET}/`));
    const imageUrls = [...uploadedUrls, ...existingExternal];
    const { error: updateError } = await supabase.from("rate_hotels")
      .update({ image_urls: imageUrls })
      .eq("id", hotel.id);
    if (updateError) throw updateError;
    hotel.image_urls = imageUrls;
    updated.push({ hotel: hotel.name, destination: hotel.destination_name, images: uploadedUrls.length, created });
  }

  console.log(JSON.stringify({ bucket: BUCKET, updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
