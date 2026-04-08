import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { PUBLIC_PROFILE_MEDIA_BUCKET, publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { Image as ImageIcon, Video, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";

interface PublicProfileMediaRow {
  id: string;
  user_id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
}

export default function PublicProfileMediaManagePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [mediaItems, setMediaItems] = useState<PublicProfileMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("public_profile_media")
        .select("id, user_id, media_type, storage_path, sort_order, created_at")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.warn("[PublicProfileMediaManage]", error);
        setMediaItems([]);
      } else {
        setMediaItems((data as PublicProfileMediaRow[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleUpload(file: File, kind: "image" | "video") {
    if (!userId) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (kind === "image" && !isImg) {
      addToast({ title: "Choose an image file", variant: "warning" });
      return;
    }
    if (kind === "video" && !isVid) {
      addToast({ title: "Choose a video file", variant: "warning" });
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "image" ? "jpg" : "mp4");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const nextSort =
      mediaItems.length === 0 ? 0 : Math.max(...mediaItems.map((m) => m.sort_order), -1) + 1;

    setUploading(true);
    try {
      const { error: upErr } = await supabase.storage
        .from(PUBLIC_PROFILE_MEDIA_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (upErr) {
        const msg =
          upErr.message?.toLowerCase().includes("bucket") &&
          upErr.message?.toLowerCase().includes("not found")
            ? `Storage bucket "${PUBLIC_PROFILE_MEDIA_BUCKET}" is missing. Run db/sql/048_public_profile_media.sql in Supabase.`
            : upErr.message;
        addToast({ title: "Upload failed", description: msg, variant: "error" });
        return;
      }

      const { data: row, error: insErr } = await supabase
        .from("public_profile_media")
        .insert({
          user_id: userId,
          media_type: kind,
          storage_path: path,
          sort_order: nextSort,
        })
        .select("id, user_id, media_type, storage_path, sort_order, created_at")
        .single();

      if (insErr) throw insErr;
      if (row) setMediaItems((prev) => [...prev, row as PublicProfileMediaRow]);
      addToast({ title: kind === "image" ? "Photo added" : "Video added", variant: "success" });
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Upload failed.";
      addToast({ title: "Could not save media", description: msg, variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(row: PublicProfileMediaRow) {
    if (!userId) return;
    setUploading(true);
    try {
      const { error: stErr } = await supabase.storage.from(PUBLIC_PROFILE_MEDIA_BUCKET).remove([row.storage_path]);
      if (stErr) console.warn(stErr);

      const { error: delErr } = await supabase.from("public_profile_media").delete().eq("id", row.id);
      if (delErr) throw delErr;
      setMediaItems((prev) => prev.filter((m) => m.id !== row.id));
      addToast({ title: "Removed", variant: "success" });
    } catch (e: unknown) {
      console.error(e);
      addToast({ title: "Could not remove", variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  const imageRows = mediaItems.filter((m) => m.media_type === "image");
  const videoRows = mediaItems.filter((m) => m.media_type === "video");

  if (!user) {
    return null;
  }

  return (
    <ProfileSubpageLayout
      title="Public profile gallery"
      description="Photos and videos shown on your public profile when others view it."
    >
      <div className="mb-8">
        <Link
          to={`/profile/${user.id}`}
          className="inline-flex items-center gap-2 text-base font-semibold text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
        >
          <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          View public profile
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-10">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f, "video");
              e.target.value = "";
            }}
          />

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">Photos</h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
                className="gap-1.5"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add photo
              </Button>
            </div>
            {imageRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No photos yet. Add images that represent your work or personality.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {imageRows.map((row) => (
                  <div key={row.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                    <img
                      src={publicProfileMediaPublicUrl(row.storage_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => void handleDelete(row)}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-md transition hover:bg-black/70 group-hover:opacity-100 md:opacity-100"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Video className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">Videos</h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={uploading}
                onClick={() => videoInputRef.current?.click()}
                className="gap-1.5"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add video
              </Button>
            </div>
            {videoRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No videos yet. Short clips can help families get to know you.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {videoRows.map((row) => (
                  <div key={row.id} className="relative overflow-hidden rounded-xl bg-black">
                    <video
                      src={publicProfileMediaPublicUrl(row.storage_path)}
                      controls
                      playsInline
                      className="max-h-[min(60vh,380px)] w-full"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => void handleDelete(row)}
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70"
                      aria-label="Remove video"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </ProfileSubpageLayout>
  );
}
