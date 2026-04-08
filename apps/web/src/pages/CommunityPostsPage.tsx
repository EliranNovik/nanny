import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { BadgeCheck, Loader2, Plus, ImagePlus, X, Users } from "lucide-react";
import {
  SERVICE_CATEGORIES,
  isAllHelpCategory,
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import {
  AVAILABILITY_STATUS_OPTIONS,
  QUICK_DETAILS_OPTIONS,
  PRICE_RANGE_MAX,
  PRICE_RANGE_MIN,
  PRICE_RANGE_STEP,
  buildAvailabilityDisplayTitle,
  computeExpiresAtIsoFromStatus,
  getAvailabilityStatusOption,
  getQuickDetailsOption,
  type AvailabilityPayload,
} from "@/lib/availabilityPosts";
import { cn } from "@/lib/utils";
import { CommunityPostsCategoryNativeSelect } from "@/components/community/CommunityPostsCategoryNativeSelect";

type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
  is_verified?: boolean | null;
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
  note: string | null;
  created_at: string;
  expires_at: string;
  status: string;
  availability_payload: AvailabilityPayload | null;
};

type PostWithMeta = CommunityPostRow & {
  author?: ProfileSnippet | null;
  images: PostImage[];
};

const BUCKET = "community-posts";

const CATEGORY_SELECT_EMPTY = "__category_empty__";
const STATUS_SELECT_EMPTY = "__status_empty__";
const QUICK_SELECT_EMPTY = "__quick_empty__";

export default function CommunityPostsPage() {
  const navigate = useNavigate();
  const { pathname: postsBasePath } = useLocation();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const isAllHelp = isAllHelpCategory(categoryParam);
  const categoryFilter =
    isAllHelp
      ? null
      : categoryParam && isServiceCategoryId(categoryParam)
        ? categoryParam
        : null;

  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [hireInterestCountByPost, setHireInterestCountByPost] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [availabilityStatusId, setAvailabilityStatusId] = useState<string>(STATUS_SELECT_EMPTY);
  const [category, setCategory] = useState<ServiceCategoryId | "">("");
  const [quickDetailsId, setQuickDetailsId] = useState<string>(QUICK_SELECT_EMPTY);
  const [showPriceRange, setShowPriceRange] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([50, 90]);
  const [areaTag, setAreaTag] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const loadPosts = useCallback(async () => {
    if (!user?.id) {
      setPosts([]);
      setHireInterestCountByPost({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let q = supabase
        .from("community_posts")
        .select(
          "id, author_id, category, title, body, note, created_at, expires_at, status, availability_payload"
        )
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
        setHireInterestCountByPost({});
        return;
      }

      const authorIds = [...new Set(list.map((p) => p.author_id))];
      const postIds = list.map((p) => p.id);

      const [authorsRes, imagesRes, hireRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, photo_url, city, role, is_verified")
          .in("id", authorIds),
        supabase
          .from("community_post_images")
          .select("id, post_id, image_url, sort_order")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("community_post_hire_interests")
          .select("community_post_id")
          .in("community_post_id", postIds)
          .eq("status", "pending"),
      ]);

      if (authorsRes.error) throw authorsRes.error;
      if (imagesRes.error) throw imagesRes.error;
      if (hireRes.error) {
        console.warn("[CommunityPostsPage] hire interest counts", hireRes.error);
      }
      const hireCounts: Record<string, number> = {};
      for (const row of hireRes.data || []) {
        const pid = row.community_post_id as string;
        hireCounts[pid] = (hireCounts[pid] || 0) + 1;
      }
      setHireInterestCountByPost(hireCounts);

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
          availability_payload: (p.availability_payload as AvailabilityPayload) ?? null,
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
      setHireInterestCountByPost({});
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

    const statusOpt = getAvailabilityStatusOption(
      availabilityStatusId === STATUS_SELECT_EMPTY ? "" : availabilityStatusId
    );
    if (!statusOpt) {
      addToast({ title: "Choose when you’re available", variant: "warning" });
      return;
    }
    if (!category || !isServiceCategoryId(category)) {
      addToast({ title: "Choose a service type", variant: "warning" });
      return;
    }
    const quickOpt = getQuickDetailsOption(
      quickDetailsId === QUICK_SELECT_EMPTY ? "" : quickDetailsId
    );
    if (!quickOpt) {
      addToast({ title: "Choose quick details", variant: "warning" });
      return;
    }

    const noteTrim = note.trim();
    if (noteTrim.length > 120) {
      addToast({ title: "Note is too long (max 120 characters)", variant: "warning" });
      return;
    }

    const area = areaTag.trim().slice(0, 40);
    const catLabel = serviceCategoryLabel(category);
    const expiresAt = computeExpiresAtIsoFromStatus(statusOpt.id);
    if (!expiresAt) {
      addToast({ title: "Invalid availability status", variant: "error" });
      return;
    }
    const rangePayload =
      showPriceRange && priceRange[0] <= priceRange[1]
        ? { min: Math.min(priceRange[0], priceRange[1]), max: Math.max(priceRange[0], priceRange[1]) }
        : null;
    const title = buildAvailabilityDisplayTitle({
      categoryLabel: catLabel,
      statusLabel: statusOpt.label,
      quickLabel: quickOpt.label,
      priceRangePerHour: rangePayload,
    });
    const payload: AvailabilityPayload = {
      availability_status: statusOpt.id,
      quick_details: quickOpt.id,
      price_range_per_hour: rangePayload,
      area_tag: area || null,
    };

    setSubmitting(true);
    try {
      const { data: post, error: insErr } = await supabase
        .from("community_posts")
        .insert({
          author_id: user.id,
          category,
          title,
          body: "",
          note: noteTrim || null,
          expires_at: expiresAt,
          availability_payload: payload,
          status: "active",
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      const postId = post.id as string;

      const file = files[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          addToast({ title: "Only image files are allowed", variant: "warning" });
        } else {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${postId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
            upsert: false,
            contentType: file.type,
          });
          if (upErr) {
            console.error(upErr);
            const desc =
              upErr.message?.toLowerCase().includes("bucket") &&
              upErr.message?.toLowerCase().includes("not found")
                ? "Storage bucket “community-posts” is missing. Run db/sql/041_storage_community_posts_bucket.sql in Supabase SQL Editor (or create the bucket in Storage → New bucket, public)."
                : upErr.message;
            addToast({ title: "Image upload failed", description: desc, variant: "error" });
          } else {
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            const { error: imgErr } = await supabase.from("community_post_images").insert({
              post_id: postId,
              image_url: pub.publicUrl,
              sort_order: 0,
            });
            if (imgErr) console.error(imgErr);
          }
        }
      }

      addToast({ title: "Your availability is live", variant: "success" });
      setDialogOpen(false);
      setAvailabilityStatusId(STATUS_SELECT_EMPTY);
      setQuickDetailsId(QUICK_SELECT_EMPTY);
      setShowPriceRange(false);
      setPriceRange([50, 90]);
      setCategory("");
      setAreaTag("");
      setNote("");
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
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell space-y-6 pt-6 md:pt-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-1 md:max-w-4xl">
          {(categoryFilter || isAllHelp) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden rounded-full text-xs md:inline-flex"
                onClick={() => navigate(postsBasePath)}
              >
                All categories
              </Button>
              <Badge variant="secondary" className="hidden text-xs font-bold md:inline-flex">
                {isAllHelp ? "All help" : serviceCategoryLabel(categoryFilter as ServiceCategoryId)}
              </Badge>
            </div>
          )}

          <CommunityPostsCategoryNativeSelect
            className="md:hidden"
            basePath={postsBasePath}
            categoryParam={categoryParam}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
                {isAllHelp
                  ? "Your availability"
                  : categoryFilter
                    ? `Your ${serviceCategoryLabel(categoryFilter)} availability`
                    : "Your availability"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Short-lived pulses — they disappear from the public board when time is up.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="rounded-full" asChild>
                <Link to="/public/posts">See who’s available</Link>
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-full"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Set availability
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
                You have no active availability pulses yet. Create one — it stays up only for the
                time you choose.
              </p>
              <Button type="button" onClick={() => setDialogOpen(true)}>
                Set availability
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-1 md:max-w-4xl lg:grid-cols-2">
            {posts.map((post) => {
              const isArchived = post.status === "archived";
              const expired = Date.parse(post.expires_at) <= Date.now();
              const description = post.note?.trim() || post.body?.trim() || null;
              const coverUrl = post.images[0]?.image_url;
              const verified = Boolean(post.author?.is_verified);
              const hireCount = hireInterestCountByPost[post.id] ?? 0;
              return (
                <Card
                  key={post.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-card sm:bg-white dark:sm:bg-card",
                    expired &&
                      "border-neutral-300/90 bg-neutral-100 text-neutral-600 shadow-none dark:border-neutral-600 dark:bg-neutral-900/75 dark:text-neutral-400"
                  )}
                  aria-label={expired ? "Expired availability post" : undefined}
                >
                  <CardContent className="relative z-[1] p-0">
                    <div className="flex items-start gap-3 px-3.5 pt-3.5 pb-2">
                      <Avatar className="h-14 w-14 shadow-none ring-0 ring-offset-0">
                        <AvatarImage
                          src={post.author?.photo_url ?? undefined}
                          className="object-cover"
                          alt=""
                        />
                        <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-lg font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200">
                          {(post.author?.full_name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-base font-semibold leading-tight">
                            {post.author?.full_name || "Member"}
                          </span>
                          {verified && (
                            <BadgeCheck
                              className="h-[18px] w-[18px] shrink-0 fill-sky-500 text-white dark:fill-sky-400"
                              aria-label="Verified"
                            />
                          )}
                          {isArchived && (
                            <Badge variant="outline" className="text-[9px] font-bold">
                              Archived
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-3.5 pb-6">
                      <p className="text-lg font-semibold leading-snug">{post.title}</p>
                    </div>

                    <div className="space-y-2 px-3.5 pb-3">
                      {post.availability_payload?.area_tag && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">Area</span>{" "}
                          {post.availability_payload.area_tag}
                        </p>
                      )}
                      {description && (
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
                          {description}
                        </p>
                      )}
                      {coverUrl && (
                        <div className="pt-1">
                          <div className="w-full max-w-[160px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/40">
                            <img
                              src={coverUrl}
                              alt=""
                              className="aspect-[4/3] w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={cn(
                        "space-y-2 border-t border-neutral-200 bg-white px-3.5 py-3 dark:border-neutral-700 dark:bg-card sm:bg-white dark:sm:bg-card",
                        expired &&
                          "border-neutral-300/80 bg-neutral-100/80 dark:border-neutral-600/80 dark:bg-neutral-900/60"
                      )}
                    >
                      <ExpiryCountdown
                        expiresAtIso={post.expires_at}
                        className={expired ? "text-neutral-500 dark:text-neutral-500" : undefined}
                      />
                      <p className="text-xs font-medium text-muted-foreground">
                        Posted {new Date(post.created_at).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {expired ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative gap-2 rounded-xl"
                            disabled
                            aria-disabled
                          >
                            <Users className="h-4 w-4" />
                            Hire interest
                            {hireCount > 0 && (
                              <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-black tabular-nums">
                                {hireCount > 99 ? "99+" : hireCount}
                              </Badge>
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative gap-2 rounded-xl"
                            asChild
                          >
                            <Link to={`/availability/post/${post.id}/hires`}>
                              <Users className="h-4 w-4" />
                              Hire interest
                              {hireCount > 0 && (
                                <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-black tabular-nums">
                                  {hireCount > 99 ? "99+" : hireCount}
                                </Badge>
                              )}
                            </Link>
                          </Button>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("w-full rounded-xl", expired && "text-neutral-500")}
                        onClick={() => navigate(`/profile/${post.author_id}`)}
                      >
                        View your public profile
                      </Button>
                    </div>
                  </CardContent>
                  {expired && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-0 z-[10] rounded-2xl bg-white/45 dark:bg-black/35"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[11] flex items-center justify-center overflow-hidden rounded-2xl"
                        aria-hidden
                      >
                        <span
                          className={cn(
                            "max-w-[95%] select-none text-center font-black uppercase leading-none tracking-[0.12em] text-neutral-400/45 dark:text-neutral-500/40",
                            "rotate-[-12deg] text-[clamp(1.75rem,11vw,3.5rem)] sm:text-[clamp(2rem,9vw,4rem)]"
                          )}
                        >
                          Expired
                        </span>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set availability</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Status sets how long the post stays up (2h / 24h / 48h). Optional note — keep it short.
            </p>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={
                  AVAILABILITY_STATUS_OPTIONS.some((o) => o.id === availabilityStatusId)
                    ? availabilityStatusId
                    : STATUS_SELECT_EMPTY
                }
                onValueChange={(v) =>
                  setAvailabilityStatusId(v === STATUS_SELECT_EMPTY ? STATUS_SELECT_EMPTY : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="When are you available?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_SELECT_EMPTY} className="text-muted-foreground">
                    Choose status
                  </SelectItem>
                  {AVAILABILITY_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label} — {o.hours}h on the board
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
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
              <Label>Quick details</Label>
              <Select
                value={
                  QUICK_DETAILS_OPTIONS.some((o) => o.id === quickDetailsId)
                    ? quickDetailsId
                    : QUICK_SELECT_EMPTY
                }
                onValueChange={(v) =>
                  setQuickDetailsId(v === QUICK_SELECT_EMPTY ? QUICK_SELECT_EMPTY : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Job shape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QUICK_SELECT_EMPTY} className="text-muted-foreground">
                    Choose quick details
                  </SelectItem>
                  {QUICK_DETAILS_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="price-range-switch">Price hint (per hour)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Optional range — drag both ends to set min–max ₪/h.
                  </p>
                </div>
                <Switch
                  id="price-range-switch"
                  checked={showPriceRange}
                  onCheckedChange={setShowPriceRange}
                  aria-label="Show hourly rate range"
                />
              </div>
              {showPriceRange && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
                  <div className="flex items-center justify-between text-sm font-bold tabular-nums">
                    <span className="text-primary">₪{priceRange[0]}/h</span>
                    <span className="text-muted-foreground text-xs font-semibold">to</span>
                    <span className="text-primary">₪{priceRange[1]}/h</span>
                  </div>
                  <Slider
                    min={PRICE_RANGE_MIN}
                    max={PRICE_RANGE_MAX}
                    step={PRICE_RANGE_STEP}
                    minStepsBetweenThumbs={1}
                    value={priceRange}
                    onValueChange={(v) => {
                      if (v.length === 2) setPriceRange([v[0], v[1]]);
                    }}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Range: ₪{PRICE_RANGE_MIN}–₪{PRICE_RANGE_MAX} (step ₪{PRICE_RANGE_STEP})
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-tag">Area (optional)</Label>
              <Input
                id="area-tag"
                value={areaTag}
                onChange={(e) => setAreaTag(e.target.value)}
                placeholder="e.g. North Tel Aviv"
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-note">Short note (optional)</Label>
              <Textarea
                id="offer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="One line — max 120 characters"
                rows={3}
                maxLength={120}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">{note.length}/120</p>
            </div>
            <div className="space-y-2">
              <Label>Photo (optional, one image)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => document.getElementById("community-post-files")?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Add photo
                </Button>
                <input
                  id="community-post-files"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFiles(f ? [f] : []);
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
                        onClick={() => setFiles([])}
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
