import fs from "fs";
import path from "path";

const KEY_NAME = "OPENAI_API_KEY";

function candidateEnvFiles(): string[] {
  const here = __dirname;
  return [
    path.resolve(process.cwd(), "backend/.env"),
    path.resolve(process.cwd(), "../backend/.env"),
    path.resolve(process.cwd(), "../../backend/.env"),
    path.resolve(here, "../../../../backend/.env"),
    path.resolve(here, "../../../../../backend/.env"),
  ];
}

function readKeyFromFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith(`${KEY_NAME}=`)) continue;
    let value = line.slice(KEY_NAME.length + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim() || null;
  }
  return null;
}

/** Prefer the process env, then OPENAI_API_KEY from backend/.env. */
export function loadOpenAiApiKey(): string | null {
  const fromProcess = process.env.OPENAI_API_KEY?.trim();
  if (fromProcess) return fromProcess;

  const seen = new Set<string>();
  for (const filePath of candidateEnvFiles()) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const value = readKeyFromFile(resolved);
    if (!value) continue;
    process.env.OPENAI_API_KEY = value;
    return value;
  }
  return null;
}

export function supportBotModel(): string {
  return process.env.OPENAI_SUPPORT_MODEL?.trim() || "gpt-6.1-sol";
}

export function supportBotConfigured(): boolean {
  return Boolean(loadOpenAiApiKey());
}
