import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MapPin,
  Plus,
  ImagePlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
};

type PostImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

type CommunityPostRow = {
  id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  status: string;
};

type PostWithMeta = CommunityPostRow & {
  author?: ProfileSnippet | null;
  images: PostImage[];
};

const BUCKET = "community-posts";

/** Radix Select must stay controlled; never use undefined for value. */
const CATEGORY_SELECT_EMPTY = "__category_empty__";

export default function CommunityPostsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const categoryFilter =
    categoryParam && isServiceCategoryId(categoryParam) ? categoryParam : null;

  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ServiceCategoryId | "">("");
  const [files, setFiles] = useState<File[]>([]);

  const loadPosts = useCallback(async () => {
    if (!user?.id) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let q = supabase
        .from("community_posts")
        .select("id, author_id, category, title, body, created_at, status")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      if (categoryFilter) {
        q = q.eq("category", categoryFilter);
      }

      const { data: rows, error } = await q;

      if (error) throw error;
      const list = (rows || []) as CommunityPostRow[];
      if (list.length === 0) {
        setPosts([]);
        return;
      }

      const authorIds = [...new Set(list.map((p) => p.author_id))];
      const postIds = list.map((p) => p.id);

      const [authorsRes, imagesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, photo_url, city, role")
          .in("id", authorIds),
        supabase
          .from("community_post_images")
          .select("id, post_id, image_url, sort_order")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true }),
      ]);

      if (authorsRes.error) throw authorsRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const authorMap = new Map(
        (authorsRes.data || []).map((a) => [a.id as string, a as ProfileSnippet])
      );
      const imagesByPost = new Map<string, PostImage[]>();
      for (const img of imagesRes.data || []) {
        const pid = img.post_id as string;
        if (!imagesByPost.has(pid)) imagesByPost.set(pid, []);
        imagesByPost.get(pid)!.push({
          id: img.id as string,
          image_url: img.image_url as string,
          sort_order: Number(img.sort_order) || 0,
        });
      }

      setPosts(
        list.map((p) => ({
          ...p,
          author: authorMap.get(p.author_id) ?? null,
          images: imagesByPost.get(p.id) ?? [],
        }))
      );
    } catch (e) {
      console.error("[CommunityPostsPage]", e);
      addToast({
        title: "Could not load posts",
        description: e instanceof Error ? e.message : "Try again later.",
        variant: "error",
      });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, categoryFilter, user?.id]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !profile) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      addToast({ title: "Add a title and details", variant: "warning" });
      return;
    }
    if (!category || !isServiceCategoryId(category)) {
      addToast({ title: "Choose a category", variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: post, error: insErr } = await supabase
        .from("community_posts")
        .insert({
          author_id: user.id,
          category,
          title: t,
          body: b,
          status: "active",
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      const postId = post.id as string;

      let sort = 0;
      for (const file of files.slice(0, 8)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${postId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (upErr) {
          console.error(upErr);
          const desc =
            upErr.message?.toLowerCase().includes("bucket") && upErr.message?.toLowerCase().includes("not found")
              ? "Storage bucket “community-posts” is missing. Run db/sql/041_storage_community_posts_bucket.sql in Supabase SQL Editor (or create the bucket in Storage → New bucket, public)."
              : upErr.message;
          addToast({ title: "Image upload failed", description: desc, variant: "error" });
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const url = pub.publicUrl;
        const { error: imgErr } = await supabase.from("community_post_images").insert({
          post_id: postId,
          image_url: url,
          sort_order: sort++,
        });
        if (imgErr) console.error(imgErr);
      }

      addToast({ title: "Your offer is live", variant: "success" });
      setDialogOpen(false);
      setTitle("");
      setBody("");
      setCategory("");
      setFiles([]);
      await loadPosts();
    } catch (err) {
      console.error(err);
      addToast({
        title: "Could not publish",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh pb-32 md:pb-24">
      <div className="app-desktop-shell space-y-6 pt-6 md:pt-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-1 md:max-w-4xl">
          {categoryFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => navigate("/posts")}
              >
                All categories
              </Button>
              <Badge variant="secondary" className="text-xs font-bold">
                {serviceCategoryLabel(categoryFilter)}
              </Badge>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
                {categoryFilter
                  ? `Your ${serviceCategoryLabel(categoryFilter)} offers`
                  : "Your service offers"}
              </h1>
              
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="rounded-full" asChild>
                <Link to="/public/posts">Browse community</Link>
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-full"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Post your offer
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="mx-auto w-full max-w-3xl border-dashed md:max-w-4xl">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                You have not posted an offer yet. Create one to appear on the public community board.
              </p>
              <Button type="button" onClick={() => setDialogOpen(true)}>
                Create a post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-1 md:max-w-4xl lg:grid-cols-2">
            {posts.map((post) => {
              const cat = isServiceCategoryId(post.category)
                ? serviceCategoryLabel(post.category)
                : post.category;
              const isArchived = post.status === "archived";
              return (
                <Card
                  key={post.id}
                  className="overflow-hidden border border-slate-200/70 shadow-sm dark:border-white/10"
                >
                  <CardContent className="p-0">
                    {post.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-0.5 bg-muted/30">
                        {post.images.slice(0, 4).map((im) => (
                          <div
                            key={im.id}
                            className={cn(
                              "relative aspect-[4/3] bg-muted",
                              post.images.length === 1 && "col-span-2 aspect-[16/9]"
                            )}
                          >
                            <img
                              src={im.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-11 w-11 border border-border/60">
                          <AvatarImage src={post.author?.photo_url ?? undefined} />
                          <AvatarFallback className="bg-orange-500/15 text-sm font-bold text-orange-700">
                            {(post.author?.full_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-foreground">
                            {post.author?.full_name || "Member"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {post.author?.city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {post.author.city}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {cat}
                            </Badge>
                            {isArchived && (
                              <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                                Archived
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <h2 className="text-lg font-black leading-snug text-slate-900 dark:text-white">
                        {post.title}
                      </h2>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {post.body}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate(`/profile/${post.author_id}`)}
                      >
                        View your public profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post your offer</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={
                  category && isServiceCategoryId(category) ? category : CATEGORY_SELECT_EMPTY
                }
                onValueChange={(v) =>
                  setCategory(
                    v === CATEGORY_SELECT_EMPTY ? "" : isServiceCategoryId(v) ? v : ""
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_SELECT_EMPTY} className="text-muted-foreground">
                    Choose category
                  </SelectItem>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-title">Title</Label>
              <Input
                id="offer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short headline"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-body">Details</Label>
              <Textarea
                id="offer-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe what you offer, availability, area…"
                rows={6}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Photos (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => document.getElementById("community-post-files")?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Add images
                </Button>
                <input
                  id="community-post-files"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const next = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...next].slice(0, 8));
                    e.target.value = "";
                  }}
                />
              </div>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"
                    >
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-background"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
