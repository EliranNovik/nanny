import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  HelpCircle,
  LifeBuoy,
  PenSquare,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GuideRole = "client" | "freelancer" | "admin" | string;

type RoleOnboardingGuideProps = {
  role: GuideRole;
  userId?: string | null;
  accountCreatedAt?: string | null;
  autoOpen?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

const GUIDE_STORAGE_VERSION = "v1";

function guideStorageKey(userId: string) {
  return `dashboardRoleGuide:${GUIDE_STORAGE_VERSION}:${userId}`;
}

function isRecentlyCreated(createdAt?: string | null) {
  if (!createdAt) return true;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return true;
  return Date.now() - createdMs < 14 * 24 * 60 * 60 * 1000;
}

export function RoleOnboardingGuide({
  role,
  userId,
  accountCreatedAt,
  autoOpen = false,
  triggerLabel,
  triggerClassName,
}: RoleOnboardingGuideProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isFreelancer = role === "freelancer";

  const primaryHint = useMemo(() => {
    return isFreelancer
      ? {
          eyebrow: "Start helping",
          title: "Go live first, then share an offer post",
          body:
            "Going live makes you visible to nearby requests. An offer post tells people what service you can provide.",
        }
      : {
          eyebrow: "Start getting help",
          title: "Share your first request post",
          body:
            "Post what you need, where you need it, and when. Helpers nearby can respond from the community feed.",
        };
  }, [isFreelancer]);

  useEffect(() => {
    if (!autoOpen || !userId || !isRecentlyCreated(accountCreatedAt)) return;
    const key = guideStorageKey(userId);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, new Date().toISOString());
    const id = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(id);
  }, [accountCreatedAt, autoOpen, userId]);

  const closeAndNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const requestPostPath = "/community/feed?compose=1&postType=request_help";
  const offerPostPath = "/community/feed?compose=1&postType=offer_service";

  return (
    <>
      {triggerLabel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={triggerClassName}
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          {triggerLabel}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-0 p-0 shadow-2xl dark:bg-zinc-950">
          <DialogHeader className="bg-gradient-to-br from-emerald-500/15 via-background to-orange-500/10 px-6 pb-4 pt-6 text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              {primaryHint.eyebrow}
            </p>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {primaryHint.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">
              {primaryHint.body}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-5 pt-4">
            <div
              className={cn(
                "rounded-2xl border p-4 dark:border-white/10",
                !isFreelancer
                  ? "border-orange-200 bg-orange-50/70 dark:bg-orange-950/20"
                  : "border-border bg-muted/30",
              )}
            >
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white">
                  <LifeBuoy className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black">Get help</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Share a request post so helpers understand what you need and can respond.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 h-10 rounded-xl bg-orange-600 px-4 font-bold text-white hover:bg-orange-700"
                    onClick={() => closeAndNavigate(requestPostPath)}
                  >
                    Share request post
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-4 dark:border-white/10",
                isFreelancer
                  ? "border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20"
                  : "border-border bg-muted/30",
              )}
            >
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Briefcase className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black">Help others</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Go live when you are available, or share an offer post to promote your service.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="h-10 rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
                      onClick={() => closeAndNavigate("/availability/post-now")}
                    >
                      <Radio className="mr-2 h-4 w-4" aria-hidden />
                      Go live
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl font-bold"
                      onClick={() => closeAndNavigate(offerPostPath)}
                    >
                      <PenSquare className="mr-2 h-4 w-4" aria-hidden />
                      Share offer post
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
