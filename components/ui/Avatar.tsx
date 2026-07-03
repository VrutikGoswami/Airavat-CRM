const TONES = ["#c65a32", "#2f7d5a", "#3a6b8f", "#7a5ea8", "#b7791f"];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
  return TONES[hash % TONES.length];
}

export function Avatar({
  initials,
  seed,
  size = 28,
}: {
  initials: string;
  seed?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: toneFor(seed ?? initials),
      }}
    >
      {initials}
    </span>
  );
}
