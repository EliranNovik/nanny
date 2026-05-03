/**
 * Green “live” indicator on circular avatars (discover strip, helper cards, open requests).
 * Positioning + breathe animation aligned with discover realtime strip avatars.
 */
export function LiveAvatarDot() {
  return (
    <span
      className="pointer-events-none absolute left-[78%] top-[9%] z-[4] block size-3.5 -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <span className="block size-full rounded-full bg-emerald-500 will-change-transform motion-safe:animate-strip-live-dot-breathe dark:bg-emerald-400" />
    </span>
  );
}
