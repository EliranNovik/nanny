import type { ReactNode } from "react";

/** Decorative QR-style pattern (not a real QR payload). */
function FakeQrCode() {
  const cells = 29;
  const size = 120;
  const cell = size / cells;
  const bits: boolean[][] = [];

  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff > 0.5;
  };

  for (let y = 0; y < cells; y++) {
    bits[y] = [];
    for (let x = 0; x < cells; x++) {
      bits[y][x] = rnd();
    }
  }

  function fillFinder(ox: number, oy: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const px = ox + x;
        const py = oy + y;
        if (px >= cells || py >= cells) continue;
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        bits[py][px] = edge || inner;
      }
    }
  }

  fillFinder(0, 0);
  fillFinder(cells - 7, 0);
  fillFinder(0, cells - 7);

  const rects: ReactNode[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (bits[y][x]) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cell}
            y={y * cell}
            width={cell}
            height={cell}
            fill="currentColor"
          />,
        );
      }
    }
  }

  return (
    <div className="inline-flex w-fit max-w-full shrink-0 items-center justify-center rounded-xl bg-white p-2.5 shadow-lg ring-1 ring-black/5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="text-slate-900"
        aria-hidden
      >
        <rect width={size} height={size} fill="white" />
        {rects}
      </svg>
    </div>
  );
}

/**
 * Hero strip: headline + QR only (no device mock). Sits in hero with page padding.
 */
export function LandingDownloadAppPromo() {
  return (
    <div className="mt-6 w-full md:mt-10">
      <div className="flex max-w-xl flex-col items-start gap-4 md:gap-5">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200/90">
            App
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            Get Tebnu on your phone
          </h2>
          <p className="max-w-sm text-sm font-medium text-white/80 drop-shadow-md">
            Scan the code with your camera to open the app. Use the same login
            as the website.
          </p>
        </div>

        <div className="w-fit pl-[max(0px,env(safe-area-inset-left))]">
          <FakeQrCode />
        </div>

        <p className="text-[10px] font-medium text-white/50">
          Store availability may vary by region.
        </p>
      </div>
    </div>
  );
}
