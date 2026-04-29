import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import {
  isServiceCategoryId,
  SERVICE_CATEGORIES,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import {
  LIVE_CAN_START_OPTIONS,
  type LiveCanStartId,
} from "@/lib/liveCanStart";
import { cn } from "@/lib/utils";

type Phase = "categories" | "when_start" | "confirm";

export default function PostAvailabilityNowPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");

  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("categories");
  const [selected, setSelected] = useState<Set<ServiceCategoryId>>(() => new Set());
  const [liveCanStartChoice, setLiveCanStartChoice] =
    useState<LiveCanStartId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categoryPickerHeaderRef = useRef<HTMLElement>(null);
  const [categoryPickerHeaderH, setCategoryPickerHeaderH] = useState(0);

  const mainTabHomePath = useMemo(() => {
    if (profile?.is_admin) return "/admin";
    if (profile?.role === "freelancer") return "/freelancer/home";
    return "/client/home";
  }, [profile?.is_admin, profile?.role]);

  /** Optional deep link: `?category=cleaning` pre-selects one category */
  useEffect(() => {
    if (categoryParam && isServiceCategoryId(categoryParam)) {
      setSelected(new Set([categoryParam]));
    }
  }, [categoryParam]);

  useLayoutEffect(() => {
    const el = categoryPickerHeaderRef.current;
    if (!el) return;
    const measure = () =>
      setCategoryPickerHeaderH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  const orderedSelected = useMemo(() => {
    const set = selected;
    return SERVICE_CATEGORIES.filter((c) => set.has(c.id)).map((c) => c.id);
  }, [selected]);

  const toggleCategory = useCallback((id: ServiceCategoryId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (phase === "confirm") {
      setPhase("when_start");
      return;
    }
    if (phase === "when_start") {
      setPhase("categories");
      return;
    }
    navigate(mainTabHomePath, { replace: true });
  }, [mainTabHomePath, navigate, phase]);

  const advanceToWhenStart = useCallback(() => {
    if (selected.size === 0) {
      addToast({
        title: "Choose at least one category",
        variant: "warning",
      });
      return;
    }
    setPhase("when_start");
  }, [addToast, selected.size]);

  const advanceToConfirm = useCallback(() => {
    if (!liveCanStartChoice) {
      addToast({
        title: "When can you start?",
        description: "Pick how soon you can take work.",
        variant: "warning",
      });
      return;
    }
    setPhase("confirm");
  }, [addToast, liveCanStartChoice]);

  const handlePublish = async () => {
    if (!user?.id || !profile) return;
    if (orderedSelected.length === 0) {
      addToast({ title: "Choose at least one category", variant: "warning" });
      return;
    }
    if (!liveCanStartChoice) {
      addToast({
        title: "When can you start?",
        description: "Go back and pick how soon you can take work.",
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const liveUntil = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();
      const payload = {
        live_until: liveUntil,
        live_categories: orderedSelected,
        live_can_start_in: liveCanStartChoice,
        available_now: true,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await supabase
        .from("freelancer_profiles")
        .update(payload)
        .eq("user_id", user.id)
        .select("user_id");

      if (updateErr) throw updateErr;

      if (!updated?.length) {
        const { error: insertErr } = await supabase
          .from("freelancer_profiles")
          .insert({
            user_id: user.id,
            ...payload,
          });
        if (insertErr) throw insertErr;
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.discoverLiveAvatars(),
      });

      addToast({
        title: "You’re live",
        description:
          "You’ll show as available for 24 hours. When that window ends, it expires—you can go live again anytime.",
        variant: "success",
      });
      navigate(mainTabHomePath, { replace: true });
    } catch (e) {
      addToast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "categories") {
    return (
      <div
        data-post-availability-no-mobile-header=""
        className="min-h-screen bg-slate-50/50 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 dark:bg-background"
      >
        <header
          ref={categoryPickerHeaderRef}
          className={cn(
            "border-b border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-background/95",
            "pb-3 pt-2.5",
            "fixed inset-x-0 z-[55] top-[env(safe-area-inset-top,0px)] md:static md:inset-auto md:z-auto md:shadow-none md:pt-4",
          )}
        >
          <div className="app-desktop-shell mx-auto w-full max-w-lg px-4">
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 rounded-full"
                onClick={handleHeaderBack}
                aria-label="Back"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Go live
                </p>
                <h1 className="text-xl font-black tracking-tight text-foreground">
                  Choose categories
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select one or more — next you’ll confirm a 24-hour availability
                  window.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div
          aria-hidden
          className="w-full shrink-0 md:hidden"
          style={{
            height:
              categoryPickerHeaderH > 0
                ? `calc(env(safe-area-inset-top, 0px) + ${categoryPickerHeaderH}px)`
                : "clamp(6.5rem, 22vh, 9rem)",
          }}
        />

        <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-2 md:max-w-5xl md:pt-0">
          <div
            className={cn(
              "grid grid-cols-2 gap-2 sm:gap-3",
              // Desktop: all categories in one horizontal row (equal-width tiles).
              "md:grid-cols-5 md:gap-3",
            )}
          >
            {SERVICE_CATEGORIES.map((cat) => {
              const isOn = selected.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "group relative aspect-square w-full min-w-0 overflow-hidden rounded-[18px] text-left outline-none border shadow-sm transition-[transform,box-shadow,border-color] duration-200",
                    "hover:shadow-md active:scale-[0.97]",
                    "focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-inset",
                    isOn
                      ? "border-emerald-500 ring-2 ring-emerald-500/40"
                      : "border-slate-200/80 dark:border-white/5",
                  )}
                  aria-pressed={isOn}
                  aria-label={`${isOn ? "Deselect" : "Select"} ${cat.label}`}
                >
                  <img
                    src={cat.imageSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-black/40"
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-md transition-colors",
                      isOn
                        ? "border-white bg-emerald-500 text-white"
                        : "border-white/70 bg-black/35 text-white/90",
                    )}
                    aria-hidden
                  >
                    {isOn ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-1.5 pb-3 pt-12 md:px-1 md:pb-2.5 md:pt-10">
                    <span className="block text-center text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg md:text-[11px] md:leading-snug">
                      {cat.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold hover:bg-emerald-700"
            disabled={selected.size === 0}
            onClick={advanceToWhenStart}
          >
            Continue
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/availability"
              className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              View availability
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (phase === "when_start") {
    return (
      <div
        data-post-availability-no-mobile-header=""
        className="min-h-screen bg-slate-50/50 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 dark:bg-background"
      >
        <header
          ref={categoryPickerHeaderRef}
          className={cn(
            "border-b border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-background/95",
            "pb-3 pt-2.5",
            "fixed inset-x-0 z-[55] top-[env(safe-area-inset-top,0px)] md:static md:inset-auto md:z-auto md:shadow-none md:pt-4",
          )}
        >
          <div className="app-desktop-shell mx-auto w-full max-w-lg px-4">
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 rounded-full"
                onClick={handleHeaderBack}
                aria-label="Back"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Go live
                </p>
                <h1 className="text-xl font-black tracking-tight text-foreground">
                  When can you start?
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  If you match a client soon, when can you realistically begin?
                </p>
              </div>
            </div>
          </div>
        </header>

        <div
          aria-hidden
          className="w-full shrink-0 md:hidden"
          style={{
            height:
              categoryPickerHeaderH > 0
                ? `calc(env(safe-area-inset-top, 0px) + ${categoryPickerHeaderH}px)`
                : "clamp(6.5rem, 22vh, 9rem)",
          }}
        />

        <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-2 md:max-w-lg md:pt-0">
          <div className="grid gap-2.5">
            {LIVE_CAN_START_OPTIONS.map((opt) => {
              const on = liveCanStartChoice === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLiveCanStartChoice(opt.id)}
                  className={cn(
                    "flex min-h-[3.25rem] w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left shadow-sm transition-colors",
                    on
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/35 dark:bg-emerald-950/40"
                      : "border-slate-200/90 bg-white hover:border-emerald-300/80 dark:border-white/10 dark:bg-zinc-900",
                  )}
                >
                  <span className="font-bold text-foreground">{opt.label}</span>
                  {on ? (
                    <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold hover:bg-emerald-700"
            disabled={!liveCanStartChoice}
            onClick={advanceToConfirm}
          >
            Continue
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/availability"
              className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              View availability
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-post-availability-no-mobile-header=""
      className="min-h-screen bg-slate-50/50 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 dark:bg-background md:pt-6"
    >
      <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 rounded-full"
            onClick={handleHeaderBack}
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Go live
            </p>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              Confirm 24 hours
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              You’ll show as{" "}
              <span className="font-semibold text-foreground">
                available now
              </span>{" "}
              in these categories for{" "}
              <span className="font-semibold text-foreground">24 hours</span>.
              When the window ends, it{" "}
              <span className="font-semibold text-foreground">expires</span>{" "}
              automatically—clients won’t see you as live until you go live
              again (Discover, Find helpers, and matching use this status).
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <p className="text-sm font-semibold text-foreground">
            {orderedSelected.length === 1
              ? "1 category"
              : `${orderedSelected.length} categories`}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {orderedSelected.map((id) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-foreground dark:border-white/5 dark:bg-white/[0.04]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {serviceCategoryLabel(id)}
              </li>
            ))}
          </ul>
          {liveCanStartChoice ? (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                Can start
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {LIVE_CAN_START_OPTIONS.find((o) => o.id === liveCanStartChoice)
                  ?.label ?? "—"}
              </p>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          className="h-12 w-full rounded-xl bg-emerald-600 font-semibold hover:bg-emerald-700"
          disabled={submitting || orderedSelected.length === 0 || !liveCanStartChoice}
          onClick={() => void handlePublish()}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Going live…
            </>
          ) : (
            "Go live"
          )}
        </Button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <Link
            to="/availability"
            className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            View availability
          </Link>
        </p>
      </div>
    </div>
  );
}
