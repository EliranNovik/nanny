import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Loader2, MessageCircle, ShieldCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ChatContactPayload } from "@/lib/chatSharePayloads";

type ContactProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  is_verified: boolean | null;
  average_rating: number | null;
  total_ratings: number | null;
  is_admin: boolean | null;
};

const profileCache = new Map<
  string,
  { value: ContactProfile | null; expiresAt: number }
>();

export function ChatSharedContactCard({
  contact,
  viewerId,
  isOwn,
  footer,
}: {
  contact: ChatContactPayload;
  viewerId?: string;
  isOwn: boolean;
  footer: ReactNode;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ContactProfile | null>(
    () => profileCache.get(contact.userId)?.value ?? null,
  );
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    const cached = profileCache.get(contact.userId);
    if (cached && cached.expiresAt > Date.now()) {
      setProfile(cached.value);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select(
        "id, full_name, photo_url, city, is_verified, average_rating, total_ratings, is_admin",
      )
      .eq("id", contact.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const value = (data as ContactProfile | null) ?? null;
        profileCache.set(contact.userId, {
          value,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });
        setProfile(value);
      });
    return () => {
      cancelled = true;
    };
  }, [contact.userId]);

  const isAdmin = profile?.is_admin === true;
  const displayName = isAdmin
    ? "Support Team"
    : profile?.full_name || contact.name || "Chat";
  const initials =
    displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const totalRatings = profile?.total_ratings ?? 0;
  const rating = profile?.average_rating ?? 0;

  const openChat = async () => {
    if (!viewerId || viewerId === contact.userId || startingChat) return;
    setStartingChat(true);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(client_id.eq.${viewerId},freelancer_id.eq.${contact.userId}),and(client_id.eq.${contact.userId},freelancer_id.eq.${viewerId})`,
      )
      .limit(1)
      .maybeSingle();
    let conversationId = existing?.id as string | undefined;
    if (!conversationId) {
      const [client_id, freelancer_id] = [viewerId, contact.userId].sort();
      const { data: created } = await supabase
        .from("conversations")
        .insert({ client_id, freelancer_id, job_id: null })
        .select("id")
        .single();
      conversationId = created?.id;
    }
    setStartingChat(false);
    if (conversationId) navigate(`/messages?conversation=${conversationId}`);
  };

  return (
    <div className="w-[240px] max-w-full pt-0.5">
      <button
        type="button"
        onClick={() => navigate(`/profile/${contact.userId}`)}
        className="flex w-full items-center gap-3 text-left active:opacity-80"
      >
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarFallback className="font-bold">{initials}</AvatarFallback>
          <AvatarImage
            src={isAdmin ? undefined : profile?.photo_url ?? undefined}
            className="object-cover"
          />
        </Avatar>
        <div className="min-w-0 flex-1 space-y-[3px]">
          <div className="flex min-w-0 items-center gap-[5px]">
            <span className="truncate text-[16px] font-extrabold">
              {displayName}
            </span>
            {isAdmin ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-white" />
            ) : profile?.is_verified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:fill-sky-400" />
            ) : null}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-[12px] font-bold",
              isOwn ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {totalRatings > 0 ? (
              <>
                <Star
                  className={cn(
                    "h-[13px] w-[13px] fill-current",
                    isOwn ? "text-yellow-200" : "text-yellow-500",
                  )}
                />
                <span>
                  {rating.toFixed(1)} ({totalRatings})
                </span>
              </>
            ) : (
              <span>No reviews</span>
            )}
          </div>
          {profile?.city ? (
            <p
              className={cn(
                "truncate text-[12px] font-semibold",
                isOwn ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {profile.city}
            </p>
          ) : null}
        </div>
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-2.5">
        {viewerId && viewerId !== contact.userId ? (
          <button
            type="button"
            onClick={() => void openChat()}
            disabled={startingChat}
            className={cn(
              "flex h-[34px] min-w-[112px] items-center justify-center gap-[7px] rounded-full px-4 text-[14px] font-extrabold",
              isOwn
                ? "bg-white/20 text-white"
                : "bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-400",
            )}
          >
            {startingChat ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Message
          </button>
        ) : (
          <span className="min-w-[112px]" />
        )}
        <div className="shrink-0">{footer}</div>
      </div>
    </div>
  );
}
