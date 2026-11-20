/**
 * Small public JPEGs for lock-screen previews.
 *
 * Chat files are often too large for FCM (1MB) and a video file is not an
 * image, so the phone never draws a preview. We store a small JPEG the
 * current app already shows via `image` and `actor_photo_url`.
 */
import crypto from "crypto";
import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { supabaseAdmin } from "../../supabase";
import { fetchLinkPreview, assertSafeHttpUrl } from "../linkPreviewFetcher";
import { fetchRemoteImageSafe } from "../fetchRemoteImage";
import { pushWarn } from "./log";

const PREVIEW_BUCKET = "chat-attachments";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_JPEG_BYTES = 900_000;

const URL_IN_TEXT_RE = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;

export type PushLinkText = {
  text: string;
  urls: string[];
};

function publicObjectUrl(objectPath: string): string | null {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const encoded = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/storage/v1/object/public/${PREVIEW_BUCKET}/${encoded}`;
}

function chatAttachmentPath(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const marker = "/chat-attachments/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function existingPublicJpeg(objectPath: string): Promise<string | null> {
  const url = publicObjectUrl(objectPath);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) return null;
    return url;
  } catch {
    return null;
  }
}

async function uploadPublicJpeg(
  objectPath: string,
  jpeg: Buffer,
): Promise<string | null> {
  if (jpeg.length < 80 || jpeg.length > MAX_JPEG_BYTES) return null;
  const url = publicObjectUrl(objectPath);
  if (!url) return null;
  const { error } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .upload(objectPath, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "604800",
    });
  if (error) {
    pushWarn("Push preview upload failed", {
      path: objectPath,
      message: error.message,
    });
    return null;
  }
  return url;
}

async function loadBytes(url: string, maxBytes: number): Promise<Buffer | null> {
  const objectPath = chatAttachmentPath(url);
  if (objectPath) {
    const { data, error } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .download(objectPath);
    if (!error && data) {
      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.length > 0 && bytes.length <= maxBytes) return bytes;
      return null;
    }
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > maxBytes) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxBytes) return null;
  return bytes;
}

async function toSmallJpeg(input: Buffer): Promise<Buffer> {
  let width = 480;
  let quality = 74;
  let last = Buffer.alloc(0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    last = await sharp(input, {
      failOn: "none",
      animated: false,
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    if (last.length > 80 && last.length <= MAX_JPEG_BYTES) return last;
    width = 320;
    quality = 58;
  }
  throw new Error("Could not make a small JPEG");
}

function ffmpegFrame(video: Buffer): Promise<Buffer> {
  const bin = ffmpegPath;
  if (!bin) return Promise.reject(new Error("ffmpeg is not available"));

  return new Promise((resolve, reject) => {
    mkdtemp(path.join(os.tmpdir(), "push-preview-"))
      .then(async (dir) => {
        const input = path.join(dir, "clip.mp4");
        const output = path.join(dir, "frame.jpg");
        const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => undefined);
        try {
          await writeFile(input, video);
          const proc = spawn(bin, [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            "0.4",
            "-i",
            input,
            "-frames:v",
            "1",
            "-vf",
            "scale=480:-2",
            "-q:v",
            "4",
            output,
          ]);
          const errors: Buffer[] = [];
          const timer = setTimeout(() => {
            proc.kill("SIGKILL");
          }, 20_000);
          proc.stderr.on("data", (chunk) => errors.push(chunk));
          proc.on("error", (err) => {
            clearTimeout(timer);
            cleanup().finally(() => reject(err));
          });
          proc.on("close", (code) => {
            clearTimeout(timer);
            readFile(output)
              .then((jpeg) => {
                cleanup().finally(() => {
                  if (code === 0 && jpeg.length > 80) resolve(jpeg);
                  else {
                    reject(
                      new Error(
                        `ffmpeg ${code}: ${Buffer.concat(errors).toString("utf8").slice(0, 180)}`,
                      ),
                    );
                  }
                });
              })
              .catch((err) => cleanup().finally(() => reject(err)));
          });
        } catch (err) {
          cleanup().finally(() => reject(err));
        }
      })
      .catch(reject);
  });
}

/** JPEG the lock screen can download for an image or video attachment. */
export async function mediaPushImage(
  messageId: string,
  sourceUrl: string,
  kind: "image" | "video",
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  const objectPath = `push-previews/${messageId}.jpg`;
  try {
    const cached = await existingPublicJpeg(objectPath);
    if (cached) return cached;
    const bytes = await loadBytes(
      sourceUrl,
      kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
    );
    if (!bytes) return null;
    const frame = kind === "video" ? await ffmpegFrame(bytes) : bytes;
    const jpeg = await toSmallJpeg(frame);
    return await uploadPublicJpeg(objectPath, jpeg);
  } catch (err) {
    pushWarn("Push media preview failed", {
      message_id: messageId,
      kind,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function splitTrailingPunct(raw: string): { core: string; tail: string } {
  const trailing = raw.match(/[),.;!?]+$/);
  if (!trailing || trailing.index === undefined) return { core: raw, tail: "" };
  return {
    core: raw.slice(0, trailing.index),
    tail: raw.slice(trailing.index),
  };
}

export function pushLinkHref(raw: string): string | null {
  const { core } = splitTrailingPunct(raw.trim());
  if (!core) return null;
  const withScheme = /^https?:\/\//i.test(core) ? core : `https://${core}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.href.split("#")[0];
  } catch {
    return null;
  }
}

/** Hostname with a link icon, instead of the full URL. */
export function shortPushLinkLabel(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    const short = host.length > 42 ? `${host.slice(0, 39)}…` : host;
    return `🔗 ${short || "link"}`;
  } catch {
    return "🔗 link";
  }
}

export function shortenPushLinkText(text: string): PushLinkText {
  const urls: string[] = [];
  const replaced = text.replace(URL_IN_TEXT_RE, (raw) => {
    const { tail } = splitTrailingPunct(raw);
    const href = pushLinkHref(raw);
    if (!href) return raw;
    urls.push(href);
    return `${shortPushLinkLabel(href)}${tail}`;
  });
  return {
    text: replaced.replace(/[ \t]{2,}/g, " ").trim(),
    urls,
  };
}

function canFetch(href: string): boolean {
  try {
    assertSafeHttpUrl(href);
    return true;
  } catch {
    return false;
  }
}

/** Open Graph (or direct image) thumbnail for a link shared in chat. */
export async function linkPushImage(pageUrl: string): Promise<string | null> {
  if (!canFetch(pageUrl)) return null;
  const hash = crypto.createHash("sha256").update(pageUrl).digest("hex").slice(0, 32);
  const objectPath = `push-previews/links/${hash}.jpg`;
  try {
    const cached = await existingPublicJpeg(objectPath);
    if (cached) return cached;

    let source = pageUrl;
    const pathname = new URL(pageUrl).pathname;
    const directImage = /\.(?:jpe?g|png|webp|gif|avif)$/i.test(pathname);
    if (!directImage) {
      const preview = await fetchLinkPreview(pageUrl);
      if (!preview.image) return null;
      source = preview.image;
    }

    const image = await fetchRemoteImageSafe(source);
    if (!image) return null;
    const jpeg = await toSmallJpeg(image.buffer);
    return await uploadPublicJpeg(objectPath, jpeg);
  } catch (err) {
    pushWarn("Push link preview failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
