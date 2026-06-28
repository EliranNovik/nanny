import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageFrame } from "@/components/page-frame";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { fetchProfilePostById } from "@/lib/fetchProfilePostById";
import { fetchJobRequestForFeedById } from "@/lib/fetchJobRequestForFeed";
import { getProfilePostMediaItems } from "@/lib/profilePostMedia";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import {
  communityFeedRequestScrollState,
  communityFeedScrollState,
} from "@/lib/communityFeedNav";
import {
  GLOBAL_POSTS_PATH,
  globalProfilePostSharePath,
  parseProfilePostShareId,
} from "@/lib/profilePostShare";
import {
  globalJobRequestSharePath,
  parseJobRequestShareId,
} from "@/lib/jobRequestShare";
import {
  resolveSharedPostDescription,
  resolveSharedPostTitle,
  resolveSharedRequestTitle,
} from "@/lib/shareLandingMeta";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

type SharedKind = "post" | "request";

function SharedContentLandingPage({ kind }: { kind: SharedKind }) {
  const { id: rawId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const cleanId = useMemo(() => {
    if (kind === "post") return parseProfilePostShareId(rawId);
    return parseJobRequestShareId(rawId);
  }, [kind, rawId]);

  useEffect(() => {
    if (!cleanId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        if (kind === "post") {
          const post = await fetchProfilePostById(cleanId!, user?.id ?? null);
          if (cancelled) return;
          if (!post) {
            setNotFound(true);
            return;
          }
          const generatedCopy = post.ai_generated_copy ?? null;
          const resolvedTitle = resolveSharedPostTitle(t, {
            generatedCopy,
            postTypeId: post.post_type_id,
            postMetadata: post.post_metadata,
            caption: post.caption,
          });
          const resolvedDescription = resolveSharedPostDescription({
            generatedCopy,
            caption: post.caption,
            title: resolvedTitle,
          });
          const media = getProfilePostMediaItems(post).find((item) => item.media_type === "image");
          setTitle(resolvedTitle);
          setAuthorName(post.author?.full_name?.trim() || "Member");
          setDescription(resolvedDescription);
          setImageUrl(
            media?.storage_path
              ? publicProfileMediaUrl(media.storage_path, { width: 960, quality: 85 })
              : null,
          );
          return;
        }

        const request = await fetchJobRequestForFeedById(cleanId!, user?.id ?? null);
        if (cancelled) return;
        if (!request) {
          setNotFound(true);
          return;
        }
        const generatedCopy = request.ai_generated_copy;
        const resolvedTitle = resolveSharedRequestTitle(t, {
          generatedCopy,
          serviceType: request.post_metadata?.category ?? request.row.service_type,
          notes: request.caption,
        });
        const resolvedDescription = resolveSharedPostDescription({
          generatedCopy,
          caption: request.caption,
          title: resolvedTitle,
        });
        setTitle(resolvedTitle);
        setAuthorName(request.author?.full_name?.trim() || "Member");
        setDescription(resolvedDescription);
        setImageUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cleanId, kind, t, user?.id]);

  if (user && cleanId) {
    const feedState =
      kind === "post"
        ? communityFeedScrollState(cleanId)
        : communityFeedRequestScrollState(cleanId);
    return (
      <Navigate
        to={GLOBAL_POSTS_PATH}
        replace
        state={feedState}
      />
    );
  }

  const feedPath =
    cleanId &&
    (kind === "post"
      ? `${GLOBAL_POSTS_PATH}?post=${encodeURIComponent(cleanId)}`
      : `${GLOBAL_POSTS_PATH}?request=${encodeURIComponent(cleanId)}`);

  return (
    <PageFrame
      variant="fullBleed"
      className="bg-white dark:bg-background"
      frameName={kind === "post" ? "shared-post" : "shared-request"}
    >
      <LandingSiteHeader
        hidePostFeedLink
        hideLeftLogo
        mobileMatchLanding
        fixedOnMobile
        hideBackButtonMobile
        variant="brand"
      />

      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-[4.25rem] md:px-6 md:pt-8">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("common.loading", { defaultValue: "Loading…" })}
          </div>
        ) : notFound || !cleanId ? (
          <div className="rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
            <p className="text-lg font-black tracking-tight text-foreground">
              {t("feed.share.notAvailableTitle", {
                defaultValue: "This post is no longer available",
              })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("feed.share.notAvailableBody", {
                defaultValue: "It may have been removed or expired.",
              })}
            </p>
            <Button
              type="button"
              className="mt-6 rounded-full"
              onClick={() => navigate("/community/feed")}
            >
              {t("feed.share.browseFeed", { defaultValue: "Browse community feed" })}
            </Button>
          </div>
        ) : (
          <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="aspect-[4/3] w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-orange-50 to-rose-50 dark:from-zinc-800 dark:to-zinc-900">
                <img src={BRAND_LOGO_SRC} alt="tebnu" className="h-16 w-auto opacity-90" />
              </div>
            )}

            <div className="space-y-4 p-6 md:p-8">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {t("feed.share.byAuthor", {
                    defaultValue: "by {{name}}",
                    name: authorName,
                  })}
                </p>
              </div>

              {description ? (
                <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
                  {description}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                {feedPath ? (
                  <Button asChild className={cn("rounded-full px-6 font-bold")}>
                    <Link to={feedPath}>
                      {t("feed.share.viewInFeed", { defaultValue: "View in feed" })}
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-6 font-bold"
                  onClick={() => navigate("/login")}
                >
                  {t("feed.share.signIn", { defaultValue: "Sign in" })}
                </Button>
              </div>
            </div>
          </article>
        )}
      </div>
    </PageFrame>
  );
}

export function SharedPostLandingPage() {
  return <SharedContentLandingPage kind="post" />;
}

export function SharedRequestLandingPage() {
  return <SharedContentLandingPage kind="request" />;
}

export function LegacySharedPostRedirect() {
  const { id } = useParams<{ id: string }>();
  const cleanId = parseProfilePostShareId(id);
  if (!cleanId) return <Navigate to="/community/feed" replace />;
  return <Navigate to={globalProfilePostSharePath(cleanId)} replace />;
}

export function LegacySharedRequestRedirect() {
  const { id } = useParams<{ id: string }>();
  const cleanId = parseJobRequestShareId(id);
  if (!cleanId) return <Navigate to="/community/feed" replace />;
  return <Navigate to={globalJobRequestSharePath(cleanId)} replace />;
}
