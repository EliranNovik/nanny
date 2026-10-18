import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, MessageCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { cn } from "@/lib/utils";

interface ContactUsButtonProps {
  phoneNumber?: string;
  className?: string;
  message?: string;
  /** `dock` sits inside the scrolled desktop CTA bar. */
  variant?: "floating" | "dock";
}

export function ContactUsButton({
  phoneNumber = "972541234567",
  className,
  message = "Hi Tebnu! I have a question about your services.",
  variant = "floating",
}: ContactUsButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isDock = variant === "dock";

  return (
    <div
      ref={rootRef}
      className={cn(
        isDock
          ? "relative z-10"
          : "fixed right-4 top-1/2 z-[100] flex -translate-y-1/2 items-center md:right-6",
        className,
      )}
    >
      <div
        className={cn(
          "absolute w-52 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-black/5 transition-all duration-200 dark:bg-zinc-800 dark:ring-white/10",
          isDock
            ? "bottom-full right-0 mb-3 origin-bottom-right"
            : "right-full mr-3 origin-right rtl:left-full rtl:right-auto rtl:ml-3 rtl:mr-0",
          open
            ? "pointer-events-auto translate-x-0 translate-y-0 opacity-100"
            : isDock
              ? "pointer-events-none translate-y-2 opacity-0"
              : "pointer-events-none translate-x-3 opacity-0",
        )}
      >
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 transition-colors hover:bg-emerald-50 dark:text-zinc-100 dark:hover:bg-emerald-500/10"
        >
          <WhatsAppIcon size={20} className="shrink-0 text-[#25D366]" />
          {t("landing.contactWhatsApp")}
        </a>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate({ pathname: "/contact", hash: "contact-form" });
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-800 transition-colors hover:bg-orange-50 dark:text-zinc-100 dark:hover:bg-orange-500/10"
        >
          <Mail className="h-5 w-5 shrink-0 text-orange-500" strokeWidth={2.25} />
          {t("landing.contactForm")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-center text-white transition-all active:scale-95",
          isDock
            ? cn(
                "relative h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 shadow-[0_8px_20px_rgba(234,88,12,0.35)] ring-2 ring-white/80 hover:scale-105 hover:shadow-[0_10px_24px_rgba(234,88,12,0.5)] dark:ring-white/15",
                open && "scale-105 ring-orange-200",
              )
            : "h-12 w-12 rounded-full bg-orange-600 shadow-[0_10px_28px_rgba(234,88,12,0.4)] hover:scale-110 hover:bg-orange-700 hover:shadow-[0_10px_28px_rgba(234,88,12,0.55)]",
        )}
        aria-label={t("landing.contactUs")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {isDock ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-white/15"
            aria-hidden
          />
        ) : null}
        <MessageCircle className="relative h-6 w-6" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
