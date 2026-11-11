import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AtSign,
  ImagePlus,
  Loader2,
  MapPin,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { PageFrame } from "@/components/page-frame";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { LocationPicker } from "@/components/LocationPicker";
import { DualLocationPicker } from "@/components/DualLocationPicker";
import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import {
  MAX_PROFILE_POST_MEDIA,
  getProfilePostMediaItems,
  type ProfilePostMediaItem,
} from "@/lib/profilePostMedia";
import { jobRequestImageUrls } from "@/lib/openHelpRequestFeedPost";
import { parseJobRequestShareId } from "@/lib/jobRequestShare";
import { parseProfilePostShareId } from "@/lib/profilePostShare";
import { supabase } from "@/lib/supabase";
import { QualityBlockNotice } from "@/components/quality/QualityBlockNotice";
import { reviewImages, saveQualityFlag, screenPost } from "@/lib/qualityReview";
import {
  bidirectionalInputProps,
} from "@/lib/textDirection";
import {
  DISCOVER_HOME_CATEGORIES,
  isServiceCategoryId,
  OTHER_HELP_SUBCATEGORIES,
} from "@/lib/serviceCategories";
import { linkedJobRequestIdFromPost } from "@/lib/createJobFromRequestHelpCompose";

type EditKind = "post" | "request";

type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

type MediaDraft =
  | { key: string; kind: "existing"; item: ProfilePostMediaItem; previewUrl: string }
  | { key: string; kind: "new"; file: File; mediaType: "image" | "video"; previewUrl: string };

type LocationValue = {
  address: string;
  lat?: number | null;
  lng?: number | null;
};

function emptyLocation(): LocationValue {
  return { address: "", lat: null, lng: null };
}

function revokeDraftUrls(items: MediaDraft[]) {
  for (const item of items) {
    if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
  }
}

export default function EditFeedPostPage({ kind }: { kind: EditKind }) {
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const postId =
    kind === "post" ? parseProfilePostShareId(rawId) : null;
  const requestId =
    kind === "request" ? parseJobRequestShareId(rawId) : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qualityBlockNote, setQualityBlockNote] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [postTypeId, setPostTypeId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [communityTitle, setCommunityTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [helpersNeeded, setHelpersNeeded] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetRateType, setBudgetRateType] = useState<"per_hour" | "fixed">("fixed");
  const [offerRate, setOfferRate] = useState("");
  const [timeframe, setTimeframe] = useState("this_week");
  const [location, setLocation] = useState<LocationValue>(emptyLocation());
  const [pickupFrom, setPickupFrom] = useState<LocationValue>(emptyLocation());
  const [pickupTo, setPickupTo] = useState<LocationValue>(emptyLocation());
  const [isPickup, setIsPickup] = useState(false);
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<ProfileSnippet[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<ProfileSnippet[]>([]);
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [baseMetadata, setBaseMetadata] = useState<Record<string, unknown>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagBoxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setNotFound(false);
    setForbidden(false);
    try {
      if (kind === "post" && postId) {
        const { data, error } = await supabase
          .from("profile_posts")
          .select(
            "id, author_id, caption, media_type, storage_path, tagged_user_ids, post_type_id, post_metadata, custom_category",
          )
          .eq("id", postId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setNotFound(true);
          return;
        }
        if (data.author_id !== user.id) {
          setForbidden(true);
          return;
        }

        const meta = (data.post_metadata as Record<string, unknown> | null) ?? {};
        setBaseMetadata(meta);
        setPostTypeId(data.post_type_id);
        setCaption((data.caption as string | null) ?? "");
        setCommunityTitle(
          typeof meta.title === "string" ? meta.title : "",
        );
        setEventName(
          typeof meta.event_name === "string" ? meta.event_name : "",
        );
        setEventDate(
          typeof meta.event_date === "string" ? meta.event_date : "",
        );
        setEventTime(
          typeof meta.event_time === "string" ? meta.event_time : "",
        );
        setHelpersNeeded(
          meta.helpers_needed != null ? String(meta.helpers_needed) : "",
        );
        const cat =
          (typeof meta.service === "string" && meta.service) ||
          (typeof meta.category === "string" && meta.category) ||
          (data.custom_category as string | null) ||
          "";
        setCategoryId(cat);
        setCustomCategory(
          typeof meta.custom_category === "string" ? meta.custom_category : "",
        );
        setBudgetAmount(
          typeof meta.budget === "number" ? String(meta.budget) : "",
        );
        setBudgetRateType(
          meta.rate_type === "per_hour" ? "per_hour" : "fixed",
        );
        setOfferRate(
          typeof meta.rate === "number" ? String(meta.rate) : "",
        );
        setTimeframe(
          typeof meta.timeframe === "string" ? meta.timeframe : "this_week",
        );
        const hasPickup =
          typeof meta.from_address === "string" &&
          Boolean(meta.from_address.trim());
        setIsPickup(hasPickup);
        if (hasPickup) {
          setPickupFrom({
            address: String(meta.from_address ?? ""),
            lat: typeof meta.from_lat === "number" ? meta.from_lat : null,
            lng: typeof meta.from_lng === "number" ? meta.from_lng : null,
          });
          setPickupTo({
            address: String(meta.to_address ?? ""),
            lat: typeof meta.to_lat === "number" ? meta.to_lat : null,
            lng: typeof meta.to_lng === "number" ? meta.to_lng : null,
          });
        } else {
          setLocation({
            address: typeof meta.location === "string" ? meta.location : "",
            lat: typeof meta.location_lat === "number" ? meta.location_lat : null,
            lng: typeof meta.location_lng === "number" ? meta.location_lng : null,
          });
        }

        const items = getProfilePostMediaItems({
          media_type: data.media_type as "image" | "video" | null,
          storage_path: data.storage_path as string | null,
          post_metadata: meta,
        });
        setMedia(
          items.map((item, index) => ({
            key: `existing-${index}-${item.storage_path}`,
            kind: "existing" as const,
            item,
            previewUrl: publicProfileMediaPublicUrl(item.storage_path),
          })),
        );

        const tagIds = Array.isArray(data.tagged_user_ids)
          ? (data.tagged_user_ids as string[])
          : [];
        if (tagIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url")
            .in("id", tagIds);
          setTaggedUsers((profiles ?? []) as ProfileSnippet[]);
        } else {
          setTaggedUsers([]);
        }

        setLinkedJobId(
          linkedJobRequestIdFromPost({
            source: "post",
            id: postId,
            post_type_id: data.post_type_id as string | null,
            post_metadata: meta,
          }),
        );
      } else if (kind === "request" && requestId) {
        const { data, error } = await supabase
          .from("job_requests")
          .select(
            "id, client_id, notes, service_type, service_details, location_city, location_lat, location_lng, when_timeframe, budget_min, budget_max, budget_rate_type",
          )
          .eq("id", requestId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setNotFound(true);
          return;
        }
        if (data.client_id !== user.id) {
          setForbidden(true);
          return;
        }

        const details =
          (data.service_details as Record<string, unknown> | null) ?? {};
        setBaseMetadata(details);
        setPostTypeId("request_help");
        setCaption((data.notes as string | null) ?? "");
        setCategoryId((data.service_type as string | null) ?? "");
        setCustomCategory(
          typeof details.other_type === "string"
            ? details.other_type
            : typeof details.custom_category === "string"
              ? details.custom_category
              : "",
        );
        setTimeframe((data.when_timeframe as string | null) ?? "this_week");
        const budget = data.budget_min ?? data.budget_max;
        setBudgetAmount(budget != null ? String(budget) : "");
        setBudgetRateType(
          data.budget_rate_type === "per_hour" ? "per_hour" : "fixed",
        );
        const hasPickup =
          typeof details.from_address === "string" &&
          Boolean(String(details.from_address).trim());
        setIsPickup(hasPickup);
        if (hasPickup) {
          setPickupFrom({
            address: String(details.from_address ?? ""),
            lat: typeof details.from_lat === "number" ? details.from_lat : null,
            lng: typeof details.from_lng === "number" ? details.from_lng : null,
          });
          setPickupTo({
            address: String(details.to_address ?? ""),
            lat: typeof details.to_lat === "number" ? details.to_lat : null,
            lng: typeof details.to_lng === "number" ? details.to_lng : null,
          });
        } else {
          setLocation({
            address: (data.location_city as string | null) ?? "",
            lat: (data.location_lat as number | null) ?? null,
            lng: (data.location_lng as number | null) ?? null,
          });
        }

        const urls = jobRequestImageUrls(details);
        setMedia(
          urls.map((url, index) => ({
            key: `existing-job-${index}`,
            kind: "existing" as const,
            item: { storage_path: url, media_type: "image" as const },
            previewUrl: url,
          })),
        );
        setTaggedUsers([]);
        setLinkedJobId(requestId);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      console.error("[EditFeedPostPage] load", e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [kind, postId, requestId, user?.id]);

  useEffect(() => {
    void load();
    return () => {
      setMedia((prev) => {
        revokeDraftUrls(prev);
        return prev;
      });
    };
  }, [load]);

  useEffect(() => {
    if (!tagQuery.trim() || !user?.id) {
      setTagResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .neq("id", user.id)
        .ilike("full_name", `%${tagQuery.trim()}%`)
        .limit(8);
      setTagResults((data ?? []) as ProfileSnippet[]);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [tagQuery, user?.id]);

  const categoryOptions = useMemo(
    () => DISCOVER_HOME_CATEGORIES.filter((c) => isServiceCategoryId(c.id)),
    [],
  );

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setMedia((prev) => {
      const room = MAX_PROFILE_POST_MEDIA - prev.length;
      if (room <= 0) return prev;
      const next: MediaDraft[] = [...prev];
      for (const file of Array.from(files).slice(0, room)) {
        const mediaType = file.type.startsWith("video/")
          ? ("video" as const)
          : ("image" as const);
        next.push({
          key: `new-${file.name}-${file.size}-${Math.random()}`,
          kind: "new",
          file,
          mediaType,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }

  function removeMedia(key: string) {
    setMedia((prev) => {
      const target = prev.find((m) => m.key === key);
      if (target?.kind === "new") URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.key !== key);
    });
  }

  async function uploadNewMedia(userId: string): Promise<ProfilePostMediaItem[]> {
    const uploaded: ProfilePostMediaItem[] = [];
    for (const item of media) {
      if (item.kind === "existing") {
        uploaded.push(item.item);
        continue;
      }
      const ext = item.file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(PUBLIC_PROFILE_MEDIA_BUCKET)
        .upload(path, item.file, { upsert: false });
      if (error) throw error;
      uploaded.push({ storage_path: path, media_type: item.mediaType });
    }
    return uploaded;
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      const imageSources: Array<File | string> = [];
      for (const item of media) {
        if (imageSources.length >= 3) break;
        if (item.kind === "new") {
          if (item.mediaType === "image") imageSources.push(item.file);
        } else if (item.item.media_type !== "video") {
          const path = item.item.storage_path;
          imageSources.push(/^https?:\/\//i.test(path) ? path : publicProfileMediaPublicUrl(path));
        }
      }
      const images = await reviewImages(imageSources);
      const reviewTitle =
        postTypeId === "community"
          ? communityTitle
          : postTypeId === "event"
            ? eventName
            : customCategory.trim() || categoryId;
      const reviewText = [caption.trim(), customCategory.trim()].filter(Boolean).join("\n");
      const screen = await screenPost({
        postType: postTypeId || kind,
        title: reviewTitle,
        text: reviewText,
        images,
      });
      if (screen.blockedNote) {
        setQualityBlockNote(screen.blockedNote);
        return;
      }
      setQualityBlockNote(null);

      if (kind === "post" && postId) {
        const uploaded = await uploadNewMedia(user.id);
        const primary = uploaded[0] ?? null;
        const extras = uploaded.slice(1);
        const metadata: Record<string, unknown> = { ...baseMetadata };

        if (postTypeId === "community") {
          metadata.title = communityTitle.trim() || null;
        }
        if (postTypeId === "event") {
          metadata.event_name = eventName.trim() || null;
          metadata.event_date = eventDate || null;
          metadata.event_time = eventTime || null;
          metadata.location = location.address.trim() || null;
          metadata.location_lat = location.lat ?? null;
          metadata.location_lng = location.lng ?? null;
          const helpers = helpersNeeded.trim()
            ? parseInt(helpersNeeded, 10)
            : null;
          if (helpers != null && Number.isFinite(helpers) && helpers > 0) {
            metadata.helpers_needed = helpers;
          } else {
            delete metadata.helpers_needed;
          }
        }
        if (postTypeId === "offer_service" || postTypeId === "request_help") {
          if (postTypeId === "offer_service") {
            metadata.service = categoryId || null;
            metadata.rate = offerRate ? Number(offerRate) : null;
            metadata.rate_type = budgetRateType;
          } else {
            metadata.category = categoryId || null;
            metadata.timeframe = timeframe;
            metadata.budget = budgetAmount ? Number(budgetAmount) : null;
            metadata.rate_type = budgetRateType;
          }
          if (customCategory.trim()) {
            metadata.custom_category = customCategory.trim();
          }
          if (isPickup) {
            metadata.from_address = pickupFrom.address;
            metadata.from_lat = pickupFrom.lat;
            metadata.from_lng = pickupFrom.lng;
            metadata.to_address = pickupTo.address;
            metadata.to_lat = pickupTo.lat;
            metadata.to_lng = pickupTo.lng;
            metadata.location = pickupFrom.address;
            metadata.location_lat = pickupFrom.lat;
            metadata.location_lng = pickupFrom.lng;
          } else {
            metadata.location = location.address.trim() || null;
            metadata.location_lat = location.lat ?? null;
            metadata.location_lng = location.lng ?? null;
            delete metadata.from_address;
            delete metadata.from_lat;
            delete metadata.from_lng;
            delete metadata.to_address;
            delete metadata.to_lat;
            delete metadata.to_lng;
          }
        }

        if (extras.length > 0) {
          metadata.media_items = extras;
        } else {
          delete metadata.media_items;
        }

        const { error } = await supabase
          .from("profile_posts")
          .update({
            caption: caption.trim() || null,
            media_type: primary?.media_type ?? null,
            storage_path: primary?.storage_path ?? null,
            tagged_user_ids: taggedUsers.map((u) => u.id),
            post_metadata: metadata,
          })
          .eq("id", postId)
          .eq("author_id", user.id);
        if (error) throw error;

        if (screen.reviewId) {
          await saveQualityFlag(screen.reviewId, { profilePostId: postId });
        }

        if (linkedJobId && postTypeId === "request_help") {
          const imageUrls = uploaded.map((item) =>
            /^https?:\/\//i.test(item.storage_path)
              ? item.storage_path
              : publicProfileMediaPublicUrl(item.storage_path),
          );
          const serviceDetails = {
            ...baseMetadata,
            images: imageUrls,
            ...(customCategory.trim()
              ? { other_type: customCategory.trim() }
              : {}),
            ...(isPickup
              ? {
                  from_address: pickupFrom.address,
                  from_lat: pickupFrom.lat,
                  from_lng: pickupFrom.lng,
                  to_address: pickupTo.address,
                  to_lat: pickupTo.lat,
                  to_lng: pickupTo.lng,
                }
              : {}),
          };
          const budgetVal = budgetAmount ? Number(budgetAmount) : null;
          await supabase
            .from("job_requests")
            .update({
              notes: caption.trim() || null,
              service_type: categoryId || null,
              service_details: serviceDetails,
              location_city: isPickup
                ? pickupFrom.address
                : location.address.trim() || null,
              location_lat: isPickup ? pickupFrom.lat : location.lat,
              location_lng: isPickup ? pickupFrom.lng : location.lng,
              when_timeframe: timeframe,
              budget_min: budgetVal,
              budget_max: budgetVal,
              budget_rate_type: budgetRateType,
            })
            .eq("id", linkedJobId)
            .eq("client_id", user.id);
        }

        addToast({ title: "Post updated", variant: "success" });
        navigate(-1);
        return;
      }

      if (kind === "request" && requestId) {
        // Job-request media stays as public URLs in service_details.images.
        // New uploads go to public-profile-media and we store their public URLs.
        const uploaded = await uploadNewMedia(user.id);
        const imageUrls = uploaded.map((item) =>
          /^https?:\/\//i.test(item.storage_path)
            ? item.storage_path
            : publicProfileMediaPublicUrl(item.storage_path),
        );
        const serviceDetails: Record<string, unknown> = {
          ...baseMetadata,
          images: imageUrls,
          ...(customCategory.trim()
            ? { other_type: customCategory.trim() }
            : {}),
        };
        if (isPickup) {
          serviceDetails.from_address = pickupFrom.address;
          serviceDetails.from_lat = pickupFrom.lat;
          serviceDetails.from_lng = pickupFrom.lng;
          serviceDetails.to_address = pickupTo.address;
          serviceDetails.to_lat = pickupTo.lat;
          serviceDetails.to_lng = pickupTo.lng;
        } else {
          delete serviceDetails.from_address;
          delete serviceDetails.from_lat;
          delete serviceDetails.from_lng;
          delete serviceDetails.to_address;
          delete serviceDetails.to_lat;
          delete serviceDetails.to_lng;
        }
        const budgetVal = budgetAmount ? Number(budgetAmount) : null;
        const { error } = await supabase
          .from("job_requests")
          .update({
            notes: caption.trim() || null,
            service_type: categoryId || null,
            service_details: serviceDetails,
            location_city: isPickup
              ? pickupFrom.address
              : location.address.trim() || null,
            location_lat: isPickup ? pickupFrom.lat : location.lat,
            location_lng: isPickup ? pickupFrom.lng : location.lng,
            when_timeframe: timeframe,
            budget_min: budgetVal,
            budget_max: budgetVal,
            budget_rate_type: budgetRateType,
          })
          .eq("id", requestId)
          .eq("client_id", user.id);
        if (error) throw error;
        addToast({ title: "Request updated", variant: "success" });
        navigate(-1);
      }
    } catch (e) {
      console.error("[EditFeedPostPage] save", e);
      addToast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const pageTitle =
    postTypeId === "offer_service"
      ? "Edit offer"
      : postTypeId === "request_help"
        ? "Edit request"
        : postTypeId === "event"
          ? "Edit event"
          : "Edit post";

  return (
    <PageFrame variant="fullBleed" frameName="edit-feed-post">
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-zinc-50 via-white to-white dark:from-[#121417] dark:via-[#101214] dark:to-[#101214]">
        <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#101214]/90">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 rtl-flip-icon" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                {pageTitle}
              </h1>
              <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Update details, photos, and tagged people
              </p>
            </div>
            <Button
              type="button"
              disabled={saving || loading || notFound || forbidden}
              onClick={() => void handleSave()}
              className="h-10 rounded-full bg-orange-600 px-4 font-bold text-white hover:bg-orange-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="me-1.5 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28">
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : notFound ? (
            <p className="py-20 text-center text-sm font-semibold text-muted-foreground">
              Post not found.
            </p>
          ) : forbidden ? (
            <p className="py-20 text-center text-sm font-semibold text-muted-foreground">
              You can only edit your own posts.
            </p>
          ) : (
            <div className="space-y-6">
              {qualityBlockNote ? <QualityBlockNotice note={qualityBlockNote} /> : null}
              {/* Media */}
              <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.05] bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#181b1f] dark:shadow-none">
                <div className="border-b border-black/[0.05] px-5 py-4 dark:border-white/10">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Media
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Add or remove photos and videos
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 p-5">
                  {media.map((item) => (
                    <div
                      key={item.key}
                      className="relative h-28 w-28 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800"
                    >
                      {item.kind === "existing" ? (
                        item.item.media_type === "video" ? (
                          <video
                            src={item.previewUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : item.mediaType === "video" ? (
                        <video
                          src={item.previewUrl}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(item.key)}
                        className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                        aria-label="Remove media"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {media.length < MAX_PROFILE_POST_MEDIA ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400 transition hover:border-orange-400 hover:text-orange-500 dark:border-zinc-700"
                    >
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[11px] font-bold">Add</span>
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              </section>

              {/* Caption / free text */}
              <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.05] bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#181b1f] dark:shadow-none">
                <div className="border-b border-black/[0.05] px-5 py-4 dark:border-white/10">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Free text
                  </h2>
                </div>
                <div className="space-y-4 p-5">
                  {postTypeId === "community" ? (
                    <input
                      type="text"
                      value={communityTitle}
                      onChange={(e) => setCommunityTitle(e.target.value)}
                      placeholder="Title"
                      className="h-12 w-full rounded-xl border border-input bg-muted/30 px-4 text-sm font-semibold outline-none focus:border-orange-500"
                    />
                  ) : null}
                  {postTypeId === "event" ? (
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="Event name"
                      className="h-12 w-full rounded-xl border border-input bg-muted/30 px-4 text-sm font-semibold outline-none focus:border-orange-500"
                    />
                  ) : null}
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={2000}
                    rows={6}
                    placeholder="Write your post…"
                    {...bidirectionalInputProps(
                      caption,
                      "w-full resize-none rounded-xl border border-input bg-muted/30 p-4 text-[15px] font-medium leading-relaxed outline-none focus:border-orange-500 dark:bg-zinc-900/40",
                    )}
                  />
                </div>
              </section>

              {/* Type-specific details */}
              {(postTypeId === "offer_service" ||
                postTypeId === "request_help" ||
                postTypeId === "event") && (
                <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.05] bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#181b1f] dark:shadow-none">
                  <div className="border-b border-black/[0.05] px-5 py-4 dark:border-white/10">
                    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Details
                    </h2>
                  </div>
                  <div className="space-y-4 p-5">
                    {(postTypeId === "offer_service" ||
                      postTypeId === "request_help") && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            Category
                          </label>
                          <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="h-12 w-full rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                          >
                            <option value="">Select category</option>
                            {categoryOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                            {OTHER_HELP_SUBCATEGORIES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {categoryId === "other_help" ||
                        OTHER_HELP_SUBCATEGORIES.some((s) => s.id === categoryId) ? (
                          <input
                            type="text"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            placeholder="Custom category"
                            className="h-12 w-full rounded-xl border border-input bg-muted/30 px-4 text-sm font-semibold"
                          />
                        ) : null}
                      </>
                    )}

                    {postTypeId === "request_help" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            When
                          </label>
                          <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="h-12 w-full rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                          >
                            <option value="now">Now</option>
                            <option value="today">Today</option>
                            <option value="tomorrow">Tomorrow</option>
                            <option value="this_week">This week</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            Budget
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={budgetAmount}
                              onChange={(e) => setBudgetAmount(e.target.value)}
                              placeholder="₪"
                              className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                            />
                            <select
                              value={budgetRateType}
                              onChange={(e) =>
                                setBudgetRateType(
                                  e.target.value === "per_hour"
                                    ? "per_hour"
                                    : "fixed",
                                )
                              }
                              className="h-12 rounded-xl border border-input bg-muted/30 px-2 text-xs font-bold"
                            >
                              <option value="fixed">Fixed</option>
                              <option value="per_hour">/hr</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {postTypeId === "offer_service" ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                          Rate
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={offerRate}
                            onChange={(e) => setOfferRate(e.target.value)}
                            placeholder="₪"
                            className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                          />
                          <select
                            value={budgetRateType}
                            onChange={(e) =>
                              setBudgetRateType(
                                e.target.value === "per_hour"
                                  ? "per_hour"
                                  : "fixed",
                              )
                            }
                            className="h-12 rounded-xl border border-input bg-muted/30 px-2 text-xs font-bold"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="per_hour">/hr</option>
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {postTypeId === "event" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="h-12 rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                        />
                        <input
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="h-12 rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                        />
                        <input
                          type="number"
                          value={helpersNeeded}
                          onChange={(e) => setHelpersNeeded(e.target.value)}
                          placeholder="Helpers needed"
                          className="col-span-2 h-12 rounded-xl border border-input bg-muted/30 px-3 text-sm font-semibold"
                        />
                      </div>
                    ) : null}

                    {(postTypeId === "offer_service" ||
                      postTypeId === "request_help") &&
                    (categoryId === "pickup_delivery" || isPickup) ? (
                      <div className="space-y-3">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={isPickup}
                            onChange={(e) => setIsPickup(e.target.checked)}
                          />
                          Pickup / delivery route
                        </label>
                        {isPickup ? (
                          <DualLocationPicker
                            fromLabel="From"
                            toLabel="To"
                            fromValue={{
                              address: pickupFrom.address,
                              lat: pickupFrom.lat ?? undefined,
                              lng: pickupFrom.lng ?? undefined,
                            }}
                            toValue={{
                              address: pickupTo.address,
                              lat: pickupTo.lat ?? undefined,
                              lng: pickupTo.lng ?? undefined,
                            }}
                            onFromChange={(v) =>
                              setPickupFrom({
                                address: v.address,
                                lat: v.lat ?? null,
                                lng: v.lng ?? null,
                              })
                            }
                            onToChange={(v) =>
                              setPickupTo({
                                address: v.address,
                                lat: v.lat ?? null,
                                lng: v.lng ?? null,
                              })
                            }
                          />
                        ) : (
                          <LocationPicker
                            label="Location"
                            value={{
                              address: location.address,
                              lat: location.lat ?? undefined,
                              lng: location.lng ?? undefined,
                            }}
                            onChange={(v) =>
                              setLocation({
                                address: v.address,
                                lat: v.lat ?? null,
                                lng: v.lng ?? null,
                              })
                            }
                            requireSelection
                          />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">
                          <MapPin className="h-3.5 w-3.5" />
                          Location
                        </label>
                        <LocationPicker
                          label="Location"
                          value={{
                            address: location.address,
                            lat: location.lat ?? undefined,
                            lng: location.lng ?? undefined,
                          }}
                          onChange={(v) =>
                            setLocation({
                              address: v.address,
                              lat: v.lat ?? null,
                              lng: v.lng ?? null,
                            })
                          }
                          requireSelection
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Tagged people — profile posts only */}
              {kind === "post" ? (
                <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.05] bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#181b1f] dark:shadow-none">
                  <div className="border-b border-black/[0.05] px-5 py-4 dark:border-white/10">
                    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Tagged people
                    </h2>
                  </div>
                  <div className="space-y-3 p-5">
                    <div ref={tagBoxRef} className="relative">
                      <AtSign className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Tag someone"
                        value={tagQuery}
                        onChange={(e) => setTagQuery(e.target.value)}
                        onBlur={() => {
                          window.setTimeout(() => setTagResults([]), 120);
                        }}
                        className="h-11 w-full rounded-full border border-input bg-muted/30 ps-10 pe-4 text-sm outline-none focus:border-orange-400"
                      />
                      {tagResults.length > 0 ? (
                        <div className="absolute inset-x-0 bottom-full z-50 mb-1.5 max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
                          {tagResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60"
                              onClick={() => {
                                if (!taggedUsers.find((t) => t.id === p.id)) {
                                  setTaggedUsers((prev) => [...prev, p]);
                                }
                                setTagQuery("");
                                setTagResults([]);
                              }}
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={p.photo_url ?? undefined} />
                                <AvatarFallback className="text-xs font-bold">
                                  {(p.full_name ?? "?").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {p.full_name ?? "Unknown"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {taggedUsers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {taggedUsers.map((person) => (
                          <span
                            key={person.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                          >
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={person.photo_url ?? undefined} />
                              <AvatarFallback className="text-[8px]">
                                {(person.full_name ?? "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            @{person.full_name}
                            <button
                              type="button"
                              onClick={() =>
                                setTaggedUsers((prev) =>
                                  prev.filter((u) => u.id !== person.id),
                                )
                              }
                              className="text-orange-500 hover:text-orange-700"
                              aria-label={`Remove ${person.full_name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
