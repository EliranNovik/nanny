/** Stable per-user color for inbox avatars without a photo. */
export function inboxAvatarFallbackClass(seed: string | null | undefined): string {
  const tones = [
    "!bg-rose-500 !text-white",
    "!bg-orange-500 !text-white",
    "!bg-amber-500 !text-white",
    "!bg-lime-600 !text-white",
    "!bg-emerald-500 !text-white",
    "!bg-teal-500 !text-white",
    "!bg-cyan-500 !text-white",
    "!bg-sky-500 !text-white",
    "!bg-blue-500 !text-white",
    "!bg-indigo-500 !text-white",
    "!bg-violet-500 !text-white",
    "!bg-purple-500 !text-white",
    "!bg-fuchsia-500 !text-white",
    "!bg-pink-500 !text-white",
    "!bg-red-500 !text-white",
    "!bg-stone-500 !text-white",
  ];
  const key = (seed ?? "").trim() || "user";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return tones[hash % tones.length];
}
