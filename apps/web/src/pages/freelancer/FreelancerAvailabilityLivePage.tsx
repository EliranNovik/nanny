import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Sparkles, Zap, ChevronRight, Radio } from "lucide-react";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { findOrCreateJobConversation } from "@/lib/findOrCreateJobConversation";
import { insertMatchIntroMessage } from "@/lib/matchIntroMessage";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/ui/toast";
import { hasProfileCoords } from "@/lib/discoverMatchPreferences";

export default function FreelancerAvailabilityLivePage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const { data: frData, isLoading: frLoading, refetch } = useFreelancerRequests(
    user?.id,
  );

  const [post, setPost] = useState<{
    id: string;
    author_id: string;
    category: string;
    title: string;
    note: string | null;
    expires_at: string;
    status: string;
    created_at: string;
  } | null>(null);
  const [postErr, setPostErr] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [instantMatching, setInstantMatching] = useState(false);

  useEffect(() => {
    if (!postId || !user?.id) return;
    let cancelled = false;
    void (async () => {
      setLoadingPost(true);
      const { data, error } = await supabase
        .from("community_posts")
        .select(
          "id, author_id, category, title, note, expires_at, status, created_at",
        )
        .eq("id", postId)
        .maybeSingle();
      if (cancelled) return;
      setLoadingPost(false);
      if (error || !data) {
        setPostErr("Post not found.");
        setPost(null);
        return;
      }
      if (data.author_id !== user.id) {
        setPostErr("This isn’t your availability post.");
        setPost(null);
        return;
      }
      setPostErr(null);
      setPost(
        data as {
          id: string;
          author_id: string;
          category: string;
          title: string;
          note: string | null;
          expires_at: string;
          status: string;
          created_at: string;
        },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, user?.id]);

  const category =
    post?.category && isServiceCategoryId(post.category)
      ? (post.category as ServiceCategoryId)
      : null;

  const relevantInbound = useMemo(() => {
    if (!category || !frData?.inboundNotifications) return [];
    return frData.inboundNotifications.filter((n: { job_requests?: { id?: string; community_post_id?: string | null; service_type?: string } }) => {
      const jr = n.job_requests;
      if (!jr?.id || jr.community_post_id) return false;
      return jr.service_type === category;
    });
  }, [frData, category]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refetch();
    }, 8000);
    return () => clearInterval(id);
  }, [refetch]);

  const onInstantMatch = useCallback(async () => {
    if (!user?.id || profile?.role !== "freelancer" || !relevantInbound[0])
      return;
    const n = relevantInbound[0] as {
      job_requests: {
        id: string;
        client_id: string;
        service_type?: string;
        location_city?: string;
        created_at?: string;
      };
    };
    const jr = n.job_requests;
    setInstantMatching(true);
    trackEvent("availability_live_instant_match", { jobId: jr.id });
    try {
      const { conversationId, created } = await findOrCreateJobConversation({
        jobId: jr.id,
        clientId: jr.client_id,
        freelancerId: user.id,
      });
      const catLabel = serviceCategoryLabel(
        (jr.service_type as ServiceCategoryId) || "other_help",
      );
      const loc = jr.location_city?.trim() || "—";
      const timeLabel = jr.created_at
        ? new Date(jr.created_at).toLocaleString()
        : new Date().toLocaleString();
      if (created) {
        await insertMatchIntroMessage({
          conversationId,
          senderId: user.id,
          payload: {
            kind: "job",
            category: catLabel,
            location: loc,
            time: timeLabel,
          },
        });
      }
      const nav = new URLSearchParams();
      nav.set("conversation", conversationId);
      nav.set("mc", encodeURIComponent(catLabel));
      nav.set("ml", encodeURIComponent(loc));
      nav.set("mt", encodeURIComponent(timeLabel));
      nav.set("mma", "1");
      trackEvent("chat_open_match", { kind: "job" });
      navigate(`/messages?${nav.toString()}`);
    } catch (e: unknown) {
      addToast({
        title: "Could not start chat",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setInstantMatching(false);
    }
  }, [user, profile?.role, relevantInbound, navigate, addToast]);

  if (loadingPost || frLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 dark:bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (postErr || !post) {
    return (
      <div className="app-desktop-shell py-12 text-center">
        <p className="text-muted-foreground">{postErr || "Not found"}</p>
        <Button className="mt-4" asChild variant="outline">
          <Link to="/freelancer/home">Home</Link>
        </Button>
      </div>
    );
  }

  const expiresAt = post.expires_at ? new Date(post.expires_at) : null;
  const liveStatus =
    post.status === "active" && expiresAt && expiresAt.getTime() > Date.now()
      ? "live"
      : "ended";

  const browseHref =
    hasProfileCoords(profile) && category
      ? (() => {
          const p = new URLSearchParams();
          p.set("category", category);
          p.set("lat", String(profile!.location_lat));
          p.set("lng", String(profile!.location_lng));
          p.set("radius", "25");
          return `/freelancer/jobs/match?${p.toString()}`;
        })()
      : "/freelancer/profile";

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-10">
      <div className="app-desktop-shell max-w-lg space-y-5 pt-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Availability live
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {post.title || "Your availability"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {liveStatus === "live"
              ? "Visible nearby — matching requests appear as notifications"
              : "This post is no longer active"}
          </p>
        </div>

        <Card className="rounded-3xl border-emerald-200/40 shadow-md">
          <CardContent className="space-y-3 p-5">
            {category && (
              <p className="text-sm font-semibold">
                {serviceCategoryLabel(category)}
              </p>
            )}
            {post.note && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {post.note}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Posted {new Date(post.created_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-950 dark:text-emerald-100">
          {relevantInbound.length === 0 ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              Waiting for matching requests in this category…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              {relevantInbound.length} request
              {relevantInbound.length !== 1 ? "s" : ""} in your queue
            </span>
          )}
        </div>

        {relevantInbound.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {relevantInbound.slice(0, 8).map(
              (n: {
                id: string;
                job_requests?: {
                  profiles?: {
                    full_name?: string | null;
                    photo_url?: string | null;
                  };
                };
              }) => {
                const jr = n.job_requests;
                const name = jr?.profiles?.full_name || "Client";
                const photo = jr?.profiles?.photo_url;
                return (
                  <div
                    key={n.id}
                    className="flex shrink-0 flex-col items-center gap-1"
                  >
                    <Avatar className="h-12 w-12 border-2 border-emerald-400/40">
                      <AvatarImage src={photo || undefined} />
                      <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[4.5rem] truncate text-[10px] text-muted-foreground">
                      {name.split(" ")[0]}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        )}

        <Button
          type="button"
          className="h-12 w-full rounded-2xl text-base font-black shadow-lg shadow-emerald-500/20"
          disabled={
            instantMatching ||
            relevantInbound.length === 0 ||
            liveStatus !== "live"
          }
          onClick={() => void onInstantMatch()}
        >
          {instantMatching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Zap className="mr-2 h-5 w-5" />
              Instant match
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Connects you with the newest open request in this category that you
          already received.
        </p>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-between rounded-2xl"
          asChild
        >
          <Link to={browseHref}>
            <span>Browse requests (optional swipe)</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>

        <Button variant="ghost" className="w-full" asChild>
          <Link to="/freelancer/explore">Explore community</Link>
        </Button>
      </div>
    </div>
  );
}
