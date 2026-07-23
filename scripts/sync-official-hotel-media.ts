import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "hotel-media";
const APPLY = process.argv.includes("--apply");

type HotelRow = {
  id: string;
  slug: string;
  name: string;
  destination_slug: string;
  destination_name: string;
  website_url: string | null;
  image_urls: string[] | null;
};

type MediaSource = {
  hotel: string;
  destination: string;
  website?: string;
  images: string[];
};

const SOURCES: MediaSource[] = [
  {
    hotel: "Kibo Safari Camp",
    destination: "Amboseli",
    website: "https://kibosafaricamp.com/",
    images: [
      "https://kibosafaricamp.com/wp-content/uploads/2019/08/KiboSafariCamp_950_IMG_9943-TENT-WITH-KILI-VIEW.jpg",
      "https://kibosafaricamp.com/wp-content/uploads/2019/08/KiboSafariCamp_950_Poolside.jpg",
      "https://kibosafaricamp.com/wp-content/uploads/2019/08/KiboSafariCamp_950_IMG_1671-HDR-DOUBLE.jpg",
    ],
  },
  {
    hotel: "Almanara Luxury Boutique Hotel & Villas",
    destination: "Diani Beach",
    images: [
      "https://assets.pintoafrica.com/2023/06/001_beach_alm-1200x800.jpg",
      "https://assets.pintoafrica.com/2023/06/002_boutiquehotel_alm-1200x705.jpg",
      "https://assets.pintoafrica.com/2023/06/006_boutiquehotel_oceanroom1-1200x666.jpg",
    ],
  },
  {
    hotel: "Diamonds Leisure Beach & Golf Resort",
    destination: "Diani Beach",
    website: "https://leisurebeachgolfresort.diamondsresorts.com/",
    images: [
      "https://d1vp8nomjxwyf1.cloudfront.net/wp-content/uploads/sites/544/2022/11/07160014/diamondsleisurebeach_gallery_01.jpg",
      "https://d1vp8nomjxwyf1.cloudfront.net/wp-content/uploads/sites/544/2022/11/07160021/diamondsleisurebeach_gallery_05.jpg",
      "https://d1vp8nomjxwyf1.cloudfront.net/wp-content/uploads/sites/544/2022/11/07160046/diamondsleisurebeach_gallery_13.jpg",
    ],
  },
  {
    hotel: "Diani Reef Beach Resort & Spa",
    destination: "Diani Beach",
    website: "https://dianireef.com/",
    images: [
      "https://dianireef.com/wp-content/uploads/2023/03/Aerial-view-of-Diani-Reef-768x512.jpg",
      "https://dianireef.com/wp-content/uploads/2023/03/Deluxe-rooms-768x576.jpg",
      "https://dianireef.com/wp-content/uploads/2023/03/Fins-Beach-Bar-Grill-2-768x512.jpg",
    ],
  },
  {
    hotel: "Jacaranda Indian Ocean Beach Resort",
    destination: "Diani Beach",
    website: "https://jacarandahotels.com/indian-ocean/",
    images: [
      "https://www.jacarandahotels.com/images/indian-ocean/gallery/1.webp",
      "https://www.jacarandahotels.com/images/indian-ocean/gallery/2.webp",
      "https://www.jacarandahotels.com/images/indian-ocean/gallery/3.webp",
    ],
  },
  {
    hotel: "Kinondo Kwetu",
    destination: "Diani Beach",
    website: "https://www.kinondo-kwetu.com/",
    images: [
      "https://images.squarespace-cdn.com/content/v1/5b7d4cabf8370ab048e8a598/1535014155544-FLPBNZR8B2AB0J0XBR3M/Kinondo+Kwetu+Hotel+3+Beach+beds+by+the+ocean%2C+Galu+Beach%2C+Diani+Beach%2C+Kenya+kopia.jpg",
      "https://images.squarespace-cdn.com/content/v1/5b7d4cabf8370ab048e8a598/1535014155719-DHCAVSY2X5NHB46QYS8A/Kinondo+Kwetu+Hotel+Beach+beds+afternoon%2C+Galu+Beach%2C+Diani+Beach%2C+Kenya.jpg",
      "https://images.squarespace-cdn.com/content/v1/5b7d4cabf8370ab048e8a598/1535014182285-DV5U4T3IZFF3E21JX96P/Kinondo+Kwetu+Hotel+Big+Beach+Ocean%2C+Galu+Beach%2C+Diani+Beach%2C+Kenya+kopia.jpg",
    ],
  },
  {
    hotel: "Lantana Galu Beach",
    destination: "Diani Beach",
    website: "https://www.lantana-galu-beach.co.ke/",
    images: [
      "https://www.lantana-galu-beach.co.ke/assets/images/content/galu-beach-large-gallery1_596958.jpg",
      "https://www.lantana-galu-beach.co.ke/assets/images/content/galu-beach-large-gallery2_438181.jpg",
      "https://www.lantana-galu-beach.co.ke/assets/images/content/galu-beach-large-gallery3_177941.jpg",
    ],
  },
  {
    hotel: "Swahili Beach Resort",
    destination: "Diani Beach",
    website: "https://swahilibeach.com/",
    images: [
      "https://swahilibeach.com/wp-content/uploads/2025/02/DJI_0147.jpg",
      "https://swahilibeach.com/wp-content/uploads/2025/05/pool-2.png",
      "https://swahilibeach.com/wp-content/uploads/2025/05/SWAHILI-BEACH-Rooms-13-1.png",
    ],
  },
  {
    hotel: "The Maji Beach Boutique Hotel",
    destination: "Diani Beach",
    website: "https://www.the-maji.com/",
    images: [
      "https://www.the-maji.com/wp-content/uploads/2025/11/The-Maji-F-2-scaled.jpg",
      "https://www.the-maji.com/wp-content/uploads/2025/11/The-Maji-HDR-11-scaled.jpg",
      "https://www.the-maji.com/wp-content/uploads/2025/06/ROOM05_0939-ph-Rosalia-Filippetti-scaled.jpg",
    ],
  },
  {
    hotel: "Mara Maisha Camp",
    destination: "Maasai Mara",
    website: "https://maramaishacamp.com/",
    images: [
      "https://maramaishacamp.com/wp-content/uploads/2023/04/mara_maisha_aerial01.jpg",
      "https://maramaishacamp.com/wp-content/uploads/2023/04/mara_maisha_common_areas01.jpg",
      "https://maramaishacamp.com/wp-content/uploads/2023/04/mara_maisha_double_room01.jpg",
    ],
  },
  {
    hotel: "Maisha Sweetwaters Camp",
    destination: "Ol Pejeta Conservancy",
    website: "https://maishasweetwaterscamp.com/",
    images: [
      "https://b3595768.smushcdn.com/3595768/wp-content/uploads/2024/09/DJI_0494.jpg?lossy=2&strip=1&webp=1",
      "https://b3595768.smushcdn.com/3595768/wp-content/uploads/2024/09/ROOM.jpg?lossy=2&strip=1&webp=1",
      "https://b3595768.smushcdn.com/3595768/wp-content/uploads/2024/09/SWIMMING-POOL.jpg?lossy=2&strip=1&webp=1",
    ],
  },
];

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function extensionFor(contentType: string): "jpg" | "png" | "webp" {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function main() {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

  console.log(JSON.stringify({ hotels: SOURCES.map((source) => ({ hotel: source.hotel, destination: source.destination, images: source.images.length })) }, null, 2));
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to download and upload official property media.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) throw bucketListError;
  const bucketOptions = {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  };
  const { error: bucketError } = buckets.some((bucket) => bucket.id === BUCKET)
    ? await supabase.storage.updateBucket(BUCKET, bucketOptions)
    : await supabase.storage.createBucket(BUCKET, bucketOptions);
  if (bucketError) throw bucketError;

  const { data: hotelData, error: hotelsError } = await supabase
    .from("rate_hotels")
    .select("id,slug,name,destination_slug,destination_name,website_url,image_urls")
    .eq("active", true);
  if (hotelsError) throw hotelsError;
  const hotels = (hotelData ?? []) as HotelRow[];
  const updated: Array<{ hotel: string; images: number }> = [];

  for (const source of SOURCES) {
    const hotel = hotels.find((row) => row.name === source.hotel && row.destination_name === source.destination);
    if (!hotel) throw new Error(`Active hotel not found: ${source.hotel} / ${source.destination}`);

    const uploadedUrls: string[] = [];
    for (const [index, sourceUrl] of source.images.entries()) {
      const response = await fetch(sourceUrl, { headers: { "User-Agent": "Airavat hotel media sync/1.0" } });
      if (!response.ok) throw new Error(`${source.hotel} image ${index + 1} returned HTTP ${response.status}`);
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!contentType.startsWith("image/")) throw new Error(`${source.hotel} image ${index + 1} is ${contentType || "not an image"}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error(`${source.hotel} image ${index + 1} exceeds 10 MB`);
      const extension = extensionFor(contentType);
      const storagePath = `${hotel.destination_slug}/${hotel.slug}/official-${String(index + 1).padStart(2, "0")}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw error;
      uploadedUrls.push(supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl);
    }

    const officialMarker = `/${hotel.destination_slug}/${hotel.slug}/official-`;
    const preservedUrls = (hotel.image_urls ?? []).filter((imageUrl) => !imageUrl.includes(officialMarker));
    const imageUrls = [...preservedUrls, ...uploadedUrls];
    const update = {
      image_urls: imageUrls,
      website_url: hotel.website_url || source.website || null,
    };
    const { error: updateError } = await supabase.from("rate_hotels").update(update).eq("id", hotel.id);
    if (updateError) throw updateError;
    updated.push({ hotel: hotel.name, images: imageUrls.length });
  }

  console.log(JSON.stringify({ bucket: BUCKET, updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
