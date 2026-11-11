import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ClipboardList, HeartHandshake, Megaphone, PenSquare, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  OTHER_HELP_SUBCATEGORIES,
  SERVICE_CATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import { categoryIllustrationSrc } from "@/lib/discoverCategoryTileIcons";
import { writeDiscoverHomeIntent } from "@/lib/discoverHomeIntent";

type Mode = "hire" | "work";

type Action = {
  key: string;
  modes: Mode[];
  icon: LucideIcon;
  label: string;
  hint: string;
  to: (id: ServiceCategoryId, sub: string | null) => string;
};

const subQuery = (sub: string | null) => (sub ? `&sub=${encodeURIComponent(sub)}` : "");

const ACTIONS: Action[] = [
  {
    key: "find_helpers",
    modes: ["hire"],
    icon: Search,
    label: "Find helpers",
    hint: "People nearby who can help",
    to: (id, sub) => `/client/helpers?category=${encodeURIComponent(id)}${subQuery(sub)}`,
  },
  {
    key: "post_request",
    modes: ["hire"],
    icon: PenSquare,
    label: "Post a request",
    hint: "Ask for help",
    to: (id, sub) => `/client/create?service=${encodeURIComponent(id)}${subQuery(sub)}`,
  },
  {
    key: "find_offers",
    modes: ["hire"],
    icon: HeartHandshake,
    label: "Find offers",
    hint: "Helpers offering this",
    to: () => "",
  },
  {
    key: "find_requests",
    modes: ["work"],
    icon: ClipboardList,
    label: "Find requests",
    hint: "People who need this",
    to: () => "",
  },
  {
    key: "post_offer",
    modes: ["work"],
    icon: Megaphone,
    label: "Offer help",
    hint: "Share what you can do",
    to: () => `${GLOBAL_POSTS_PATH}?compose=1&postType=offer_service`,
  },
];

function discoverHomeCategoryPath(
  intent: Mode,
  id: ServiceCategoryId,
  sub: string | null,
  role: string | null | undefined,
) {
  const path = role === "freelancer" ? "/freelancer/home" : "/client/home";
  const params = new URLSearchParams();
  params.set("category", id);
  if (sub) params.set("sub", sub);
  params.set("home", intent);
  return `${path}?${params.toString()}`;
}

export function HeaderCategoryMenus({ mode, className }: { mode: Mode; className?: string }) {
  const actions = ACTIONS.filter((a) => a.modes.includes(mode));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [openId, setOpenId] = useState<ServiceCategoryId | null>(null);
  const [otherSub, setOtherSub] = useState<string | null>(null);

  useEffect(() => {
    if (openId !== "other_help") setOtherSub(null);
  }, [openId]);
  const rootRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openNow = (id: ServiceCategoryId) => {
    cancelClose();
    setOpenId(id);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenId(null), 180);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!openId) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  return (
    <nav ref={rootRef} aria-label="Categories" className={cn("items-center gap-0.5", className)}>
      {SERVICE_CATEGORIES.map((cat) => {
        const id = cat.id as ServiceCategoryId;
        const open = openId === id;
        const label = t(`discoverHome.filters.${id}`, { defaultValue: cat.label });
        return (
          <div
            key={id}
            className="relative"
            onMouseEnter={() => openNow(id)}
            onMouseLeave={closeSoon}
          >
            <button
              type="button"
              onClick={() => openNow(id)}
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70",
                open && mode === "work"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : open
                  ? "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
              )}
            >
              {label}
            </button>
            {open ? (
              <div
                role="menu"
                className={cn(
                  "absolute start-0 top-[calc(100%+10px)] z-[220] overflow-hidden rounded-2xl p-1.5",
                  id === "other_help" ? "w-[25rem]" : "w-[17.5rem]",
                  "border border-border/40 bg-background/95 shadow-xl backdrop-blur-xl",
                  "animate-in fade-in zoom-in-95 duration-150",
                )}
              >
                <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
                  <img
                    src={categoryIllustrationSrc(id)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="text-[15px] font-bold text-foreground">{cat.label}</span>
                </div>
                {id === "other_help" ? (
                  <div className="mb-1.5 border-b border-border/50 px-1.5 pb-2.5">
                    <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Pick a type
                    </p>
                    <div className="grid max-h-[15rem] grid-cols-2 gap-1 overflow-y-auto">
                      {[{ id: null as string | null }, ...OTHER_HELP_SUBCATEGORIES].map((sub) => {
                        const selected = otherSub === sub.id;
                        return (
                          <button
                            key={sub.id ?? "all"}
                            type="button"
                            onClick={() => setOtherSub(sub.id)}
                            aria-pressed={selected}
                            className={cn(
                              "flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                              selected
                                ? mode === "work"
                                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                                  : "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30"
                                : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            )}
                          >
                            <img
                              src={categoryIllustrationSrc(sub.id ?? "other_help")}
                              alt=""
                              className="h-6 w-6 shrink-0 rounded-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <span className="truncate">
                              {sub.id
                                ? t(`otherHelpSubcategories.${sub.id}`)
                                : t("discoverHome.filters.allOther", { defaultValue: "All other" })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {actions.map(({ key, icon: Icon, label: actionLabel, hint, to }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenId(null);
                      const sub = id === "other_help" ? otherSub : null;
                      if (key === "find_offers" || key === "find_requests") {
                        const intent = key === "find_offers" ? "hire" : "work";
                        writeDiscoverHomeIntent(intent);
                        navigate(discoverHomeCategoryPath(intent, id, sub, profile?.role));
                        return;
                      }
                      navigate(to(id, sub));
                    }}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-200",
                      "focus-visible:outline-none",
                      mode === "work"
                        ? "hover:bg-emerald-50 focus-visible:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:focus-visible:bg-emerald-500/10"
                        : "hover:bg-orange-50 focus-visible:bg-orange-50 dark:hover:bg-orange-500/10 dark:focus-visible:bg-orange-500/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6 shrink-0 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110",
                        mode === "work"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-orange-500 dark:text-orange-400",
                      )}
                      strokeWidth={2}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[14px] font-semibold leading-tight text-foreground transition-colors",
                          mode === "work"
                            ? "group-hover:text-emerald-800 dark:group-hover:text-emerald-300"
                            : "group-hover:text-orange-700 dark:group-hover:text-orange-300",
                        )}
                      >
                        {actionLabel}
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">{hint}</span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 rtl-flip-icon",
                        mode === "work" ? "text-emerald-700 dark:text-emerald-400" : "text-orange-500 dark:text-orange-400",
                      )}
                      strokeWidth={2.5}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
