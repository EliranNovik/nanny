import {
  Baby,
  Briefcase,
  CalendarDays,
  Clock,
  Coins,
  Heart,
  LifeBuoy,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LandingHeroPost } from "@/lib/fetchLandingHeroPosts";
import { requestPostBadgeClass, requestPostCtaClass } from "@/lib/requestPostTheme";

const EVENT_IMAGE = "/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png";

/** External portrait URLs for marketing collage avatars */
const PORTRAITS = {
  hero: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=face",
  eitan: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=128&h=128&fit=crop&crop=face",
} as const;

const AVATARS = {
  michal: "/images/helper_profile_1.png",
  tom: "/images/helper_profile_2.png",
  rachel: "/images/helper_profile_3.png",
  david: "/images/helper_profile_4.png",
  maya: "/pexels-rdne-6646861.jpg",
  daniel: "/pexels-dmitry-rodionov-30660800.jpg",
  noa: "/pexels-roman-odintsov-12725452.jpg",
  yoni: "/pexels-tima-miroshnichenko-6197046.jpg",
  shira: "/pexels-rocketmann-prod-9486685.jpg",
  avi: "/images/helper_profile_2.png",
} as const;

type MockComment = {
  id: string;
  body: string;
  authorName: string;
  authorInitials: string;
  photoUrl: string;
};

type MockAuthor = {
  name: string;
  initials: string;
  photoUrl: string;
  postedLabel: string;
};

type CollagePostTypeId = "offer_service" | "event" | "request_help";

type CollageMediaMock = {
  author: MockAuthor;
  postTypeId: "offer_service" | "event";
  actionLabel: string;
  title?: string;
  subtitle?: string;
  comments: MockComment[];
};

type CollageTextPostMock = {
  author: MockAuthor;
  postTypeId: CollagePostTypeId;
  actionLabel: string;
  title: string;
  body: string;
  whenLabel?: string;
  rateLabel?: string;
  imageUrl?: string;
  comments: MockComment[];
};

const ELECTRICIAN_OFFER_TEXT_POST: CollageTextPostMock = {
  author: {
    name: "Eitan",
    initials: "E",
    photoUrl: PORTRAITS.eitan,
    postedLabel: "3h ago · Tel Aviv",
  },
  postTypeId: "offer_service",
  actionLabel: "Message Eitan",
  title: "Electrician & installation help",
  body: "Outlets, light fixtures, appliance installs, and TV mounting. Licensed technician — careful, tidy work.",
  whenLabel: "This week · Tel Aviv area",
  rateLabel: "₪120 per hour",
  comments: [
    {
      id: "left-c1",
      body: "Need a ceiling fan installed — are you free Thursday?",
      authorName: "Maya",
      authorInitials: "M",
      photoUrl: AVATARS.maya,
    },
    {
      id: "left-c2",
      body: "Great reviews! Sending you a message 🙌",
      authorName: "Daniel",
      authorInitials: "D",
      photoUrl: AVATARS.daniel,
    },
  ],
};

const EVENT_CARD_MOCK: CollageMediaMock = {
  author: {
    name: "Tom",
    initials: "T",
    photoUrl: AVATARS.tom,
    postedLabel: "5h ago · Tel Aviv",
  },
  postTypeId: "event",
  actionLabel: "I'm interested",
  title: "Rooftop Social Night",
  subtitle: "Live DJ · Drinks & refreshments · Tel Aviv",
  comments: [
    {
      id: "center-c1",
      body: "Count me in for Thursday!",
      authorName: "Noa",
      authorInitials: "N",
      photoUrl: AVATARS.noa,
    },
    {
      id: "center-c2",
      body: "Such a great community event.",
      authorName: "Yoni",
      authorInitials: "Y",
      photoUrl: AVATARS.david,
    },
  ],
};

const NANNY_TEXT_POST: CollageTextPostMock = {
  author: {
    name: "Rachel",
    initials: "R",
    photoUrl: AVATARS.rachel,
    postedLabel: "1h ago · Ramat Gan",
  },
  postTypeId: "request_help" as const,
  actionLabel: "Offer help",
  title: "Need a nanny this weekend",
  body: "Looking for a trusted babysitter Friday 6–10pm. Two kids ages 4 & 7. Experience with children required.",
  whenLabel: "Friday evening",
  rateLabel: "₪120 per hour",
  comments: [
    {
      id: "right-c1",
      body: "I'm available! I have 5 years of nanny experience.",
      authorName: "Shira",
      authorInitials: "S",
      photoUrl: AVATARS.shira,
    },
    {
      id: "right-c2",
      body: "Happy to help — sent you a message!",
      authorName: "Avi",
      authorInitials: "A",
      photoUrl: AVATARS.avi,
    },
  ],
};

const NANNY_TEXT_POST_MOBILE: CollageTextPostMock = {
  ...NANNY_TEXT_POST,
  author: {
    ...NANNY_TEXT_POST.author,
    name: "Nick",
    initials: "N",
  },
};

const HERO_PROFILE = {
  name: "Lia",
  initials: "L",
  photoUrl: PORTRAITS.hero,
};

const POST_TYPE_LABELS: Record<string, string> = {
  request_help: "Request",
  offer_service: "Offer",
  event: "Event",
  community: "Community",
};

function postTypeBadgeClass(typeId: string) {
  return cn(
    "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold lg:text-[11px]",
    typeId === "request_help" && requestPostBadgeClass,
    typeId === "offer_service" && "bg-emerald-100 text-emerald-700",
    typeId === "event" && "bg-violet-100 text-violet-700",
    typeId === "community" && "bg-blue-100 text-blue-700",
  );
}

function postTypeIcon(typeId: string) {
  switch (typeId) {
    case "request_help":
      return LifeBuoy;
    case "offer_service":
      return Briefcase;
    case "event":
      return CalendarDays;
    default:
      return Users;
  }
}

function collageActionButtonClass(typeId: CollagePostTypeId) {
  return cn(
    "inline-flex w-full items-center justify-center rounded-lg border-0 px-2 font-semibold shadow-none",
    typeId === "request_help" && requestPostCtaClass,
    typeId === "offer_service" &&
      "bg-emerald-600 text-white hover:bg-emerald-700",
    typeId === "event" &&
      "bg-violet-600 text-white hover:bg-violet-700",
  );
}

function CollagePostTypeBadge({
  typeId,
  className,
}: {
  typeId: string;
  className?: string;
}) {
  const Icon = postTypeIcon(typeId);
  return (
    <span className={cn(postTypeBadgeClass(typeId), className)}>
      <Icon className="mr-1 h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      {POST_TYPE_LABELS[typeId] ?? typeId}
    </span>
  );
}

function CollageAvatar({
  photoUrl,
  initials,
  className,
}: {
  photoUrl: string;
  initials: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0 ring-2 ring-white", className)}>
      <AvatarImage src={photoUrl} alt="" className="object-cover" />
      <AvatarFallback className="bg-slate-100 text-xs font-black text-slate-600">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function CollagePostHeader({
  author,
  postTypeId,
  compact,
}: {
  author: MockAuthor;
  postTypeId: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-2 border-b border-slate-100 bg-white antialiased",
        compact ? "px-2 py-1.5" : "px-2.5 py-2 lg:px-3 lg:py-2.5",
      )}
    >
      <CollageAvatar
        photoUrl={author.photoUrl}
        initials={author.initials}
        className={compact ? "h-12 w-12 lg:h-14 lg:w-14" : "h-14 w-14 lg:h-16 lg:w-16"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-1.5">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-bold leading-tight text-slate-900",
                compact ? "text-sm" : "text-base",
              )}
            >
              {author.name}
            </p>
            <p
              className={cn(
                "mt-0.5 truncate font-medium text-slate-500",
                compact ? "text-[11px]" : "text-xs",
              )}
            >
              {author.postedLabel}
            </p>
          </div>
          <CollagePostTypeBadge typeId={postTypeId} />
        </div>
      </div>
    </div>
  );
}

function CollageActionButton({
  typeId,
  label,
  compact,
}: {
  typeId: CollagePostTypeId;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-slate-100 bg-white",
        compact ? "px-2 py-1.5" : "px-2.5 py-2 lg:px-3",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className={cn(
          collageActionButtonClass(typeId),
          "antialiased",
          compact ? "h-8 text-xs" : "h-9 text-xs lg:text-sm",
        )}
      >
        {label}
      </button>
    </div>
  );
}

function CollageCommentSheet({
  comments,
  compact,
}: {
  comments: MockComment[];
  compact?: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-2.5 py-2.5 antialiased lg:px-3 lg:py-3">
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-2">
            <CollageAvatar
              photoUrl={comment.photoUrl}
              initials={comment.authorInitials}
              className={cn(
                "ring-1 ring-slate-100",
                compact ? "h-6 w-6" : "h-7 w-7 lg:h-8 lg:w-8",
              )}
            />
            <p
              className={cn(
                "min-w-0 leading-snug text-slate-700",
                compact ? "text-xs" : "text-sm",
              )}
            >
              <span className="font-bold text-slate-900">
                {comment.authorName}
              </span>{" "}
              <span className="line-clamp-2">{comment.body}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollageCardShell({
  shellClassName,
  tilt,
  children,
}: {
  shellClassName?: string;
  tilt: string;
  children: ReactNode;
}) {
  const counterTilt =
    tilt === "-rotate-5"
      ? "rotate-5"
      : tilt === "rotate-2"
        ? "-rotate-2"
        : tilt === "rotate-[4deg]"
          ? "-rotate-[4deg]"
          : "";

  return (
    <div className={cn("absolute", shellClassName, tilt)}>
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/5",
          counterTilt,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CollageMediaCard({
  mock,
  imageUrl,
  compact,
  shellClassName,
  tilt,
}: {
  mock: CollageMediaMock;
  imageUrl: string | null;
  compact?: boolean;
  shellClassName?: string;
  tilt: string;
}) {
  const showHeart = mock.postTypeId === "event";

  return (
    <CollageCardShell shellClassName={shellClassName} tilt={tilt}>
      <CollagePostHeader
        author={mock.author}
        postTypeId={mock.postTypeId}
        compact={compact}
      />
      {mock.title ? (
        <div className="shrink-0 border-b border-slate-100 bg-white px-2.5 py-2 antialiased lg:px-3">
          <p className="text-xs font-bold leading-snug text-slate-900 lg:text-sm">
            {mock.title}
          </p>
          {mock.subtitle ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600 lg:text-xs">
              {mock.subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div
            className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200"
            aria-hidden
          />
        )}
          {showHeart ? (
            <div className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg lg:bottom-3 lg:right-3 lg:h-11 lg:w-11">
              <Heart className="h-5 w-5 fill-white lg:h-6 lg:w-6" strokeWidth={2} aria-hidden />
            </div>
          ) : null}
      </div>
      <CollageActionButton
        typeId={mock.postTypeId}
        label={mock.actionLabel}
        compact={compact}
      />
      <CollageCommentSheet comments={mock.comments} compact={compact} />
    </CollageCardShell>
  );
}

function CollageTextPostCard({
  post,
  shellClassName,
  tilt,
  hideComments = false,
}: {
  post: CollageTextPostMock;
  shellClassName?: string;
  tilt: string;
  hideComments?: boolean;
}) {
  const isOffer = post.postTypeId === "offer_service";
  const TitleIcon = isOffer ? Wrench : Baby;

  return (
    <CollageCardShell shellClassName={shellClassName} tilt={tilt}>
      <CollagePostHeader
        author={post.author}
        postTypeId={post.postTypeId}
        compact
      />
      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-1.5 pt-1.5 antialiased">
        <div className="h-full rounded-xl bg-white p-2.5">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 text-xs font-bold leading-snug text-slate-900 lg:text-sm">
                <TitleIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" strokeWidth={2.25} aria-hidden />
                <span>{post.title}</span>
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                {post.body}
              </p>
              <div className="mt-2 space-y-1 text-xs font-medium text-slate-700">
                {post.whenLabel ? (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                    <span>{post.whenLabel}</span>
                  </div>
                ) : null}
                {post.rateLabel ? (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Coins className="h-3 w-3 shrink-0" aria-hidden />
                    <span>{post.rateLabel}</span>
                  </div>
                ) : null}
              </div>
            </div>
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-black/5 lg:h-[4.5rem] lg:w-[4.5rem]"
                loading="lazy"
              />
            ) : null}
          </div>
        </div>
      </div>
      <CollageActionButton
        typeId={post.postTypeId}
        label={post.actionLabel}
        compact
      />
      {!hideComments ? (
        <CollageCommentSheet comments={post.comments} compact />
      ) : null}
    </CollageCardShell>
  );
}

function pickEventImage(posts: LandingHeroPost[]): string {
  const eventFromFeed = posts.find((p) => p.postTypeId === "event")?.imageUrl;
  return eventFromFeed ?? EVENT_IMAGE;
}

function useResolvedEventImage(
  posts: LandingHeroPost[],
  loading: boolean,
): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const targetUrl = loading ? null : pickEventImage(posts);

  useEffect(() => {
    if (!targetUrl) {
      setResolvedUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setResolvedUrl(targetUrl);
    };
    img.onerror = () => {
      if (!cancelled) setResolvedUrl(targetUrl);
    };
    img.src = targetUrl;

    return () => {
      cancelled = true;
    };
  }, [targetUrl]);

  return resolvedUrl;
}

type LandingHeroCollageProps = {
  posts: LandingHeroPost[];
  loading?: boolean;
  className?: string;
  /** Inline mobile hero — scales the desktop collage to fit width */
  embedded?: boolean;
};

const COLLAGE_DESIGN_WIDTH = 640;
const COLLAGE_DESIGN_HEIGHT = 720;
/** Slightly larger than fit-to-width on mobile embedded hero */
const MOBILE_EMBEDDED_SCALE_BOOST = 1.18;

function LandingHeroCollageCanvas({
  posts,
  loading = false,
  className,
  embedded = false,
}: LandingHeroCollageProps) {
  const eventImage = useResolvedEventImage(posts, loading);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-white",
        className,
      )}
      aria-hidden={loading}
    >
      <div
        className={cn(
          "relative mx-auto h-full w-full px-6 lg:px-10",
          embedded ? "pb-20 pt-2" : "pb-28 pt-28 lg:pb-32 lg:pt-32",
        )}
      >
        {!embedded ? (
          <CollageTextPostCard
            post={ELECTRICIAN_OFFER_TEXT_POST}
            shellClassName="left-[2%] top-[14%] z-10 h-[42%] w-[38%]"
            tilt="-rotate-5"
          />
        ) : null}

        <CollageMediaCard
          mock={EVENT_CARD_MOCK}
          imageUrl={eventImage}
          shellClassName={
            embedded
              ? "left-[3%] top-[6%] z-20 h-[54%] w-[50%]"
              : "left-[30%] top-[12%] z-20 h-[52%] w-[44%]"
          }
          tilt={embedded ? "rotate-0" : "rotate-2"}
        />

        <CollageTextPostCard
          post={embedded ? NANNY_TEXT_POST_MOBILE : NANNY_TEXT_POST}
          shellClassName={
            embedded
              ? "left-[46%] top-[12%] z-30 h-[50%] w-[50%]"
              : "left-[65%] top-[38%] z-30 h-[34%] w-[34%]"
          }
          tilt={embedded ? "rotate-0" : "rotate-[4deg]"}
          hideComments={embedded}
        />

        <div
          className={cn(
            "absolute z-40",
            embedded ? "bottom-[26%] left-[10%]" : "bottom-[24%] left-[16%]",
          )}
        >
          <div className="rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-emerald-400 p-1 shadow-[0_20px_48px_-12px_rgba(59,130,246,0.55)]">
            <div className="rounded-full bg-white p-1">
              <Avatar className="h-[7.75rem] w-[7.75rem] lg:h-[9.25rem] lg:w-[9.25rem]">
                <AvatarImage
                  src={HERO_PROFILE.photoUrl}
                  alt={HERO_PROFILE.name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-slate-100 text-2xl font-black text-slate-700">
                  {HERO_PROFILE.initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {embedded ? (
          <p className="absolute bottom-10 left-6 right-6 max-w-md text-left text-[2.35rem] font-black leading-[1.05] tracking-tight text-slate-900 lg:bottom-14 lg:left-10 lg:text-[2.75rem] xl:text-[3.25rem]">
            Explore the community you{" "}
            <span className="text-orange-500">love</span>.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LandingHeroCollageEmbedded({
  posts,
  loading = false,
  className,
}: LandingHeroCollageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateScale = () => {
      const width = node.clientWidth;
      if (width > 0) {
        setScale((width / COLLAGE_DESIGN_WIDTH) * MOBILE_EMBEDDED_SCALE_BOOST);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden bg-white", className)}
    >
      <div
        className="flex justify-center"
        style={{ height: COLLAGE_DESIGN_HEIGHT * scale }}
      >
        <div
          className="relative bg-white"
          style={{
            width: COLLAGE_DESIGN_WIDTH,
            height: COLLAGE_DESIGN_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <LandingHeroCollageCanvas
            posts={posts}
            loading={loading}
            embedded
          />
        </div>
      </div>
    </div>
  );
}

export function LandingHeroCollage({
  posts,
  loading = false,
  className,
  embedded = false,
}: LandingHeroCollageProps) {
  if (embedded) {
    return (
      <LandingHeroCollageEmbedded
        posts={posts}
        loading={loading}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative h-full min-h-[min(100vh,920px)] w-full overflow-hidden bg-white",
        className,
      )}
    >
      <div className="relative mx-auto h-full w-full">
        <LandingHeroCollageCanvas posts={posts} loading={loading} />
      </div>
    </div>
  );
}
