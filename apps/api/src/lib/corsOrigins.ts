const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5175",
];

const DEFAULT_PROD_ORIGINS = [
  "https://www.tebnu.com",
  "https://tebnu.com",
  "http://www.tebnu.com",
  "http://tebnu.com",
];

export function getAllowedCorsOrigins(): string[] {
  const fromEnv =
    process.env.CORS_ORIGIN?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const baseAllowed = fromEnv.length > 0 ? fromEnv : DEFAULT_DEV_ORIGINS;
  return [...new Set([...baseAllowed, ...DEFAULT_PROD_ORIGINS])];
}


function isDevNgrokOrigin(origin: string): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (origin.endsWith(".ngrok-free.app") || origin.endsWith(".ngrok.io"))
  );
}

/** Dynamic origin check — required when credentials: true. */
export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean | string) => void,
): void {
  const allowed = getAllowedCorsOrigins();

  // Same-origin / server-to-server (no Origin header)
  if (!origin) {
    callback(null, allowed[0]);
    return;
  }

  if (allowed.includes(origin) || isDevNgrokOrigin(origin)) {
    callback(null, origin);
    return;
  }

  console.warn("[CORS] Blocked origin:", origin, "allowed:", allowed.join(", "));
  callback(new Error(`CORS blocked origin: ${origin}`));
}
