import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";
import { TEBNU_JOIN_COMMUNITY_BUTTON_CLASS } from "@/lib/tebnuBrandButton";

export type WhatIsTebnuDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** “What is tebnu?” intro modal — shared across landing, feed guest UI, etc. */
export function WhatIsTebnuDialog({ open, onOpenChange }: WhatIsTebnuDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-0 bg-background px-6 pb-6 pt-7 shadow-2xl outline-none ring-0 focus:outline-none">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-black tracking-tight">
            What is tebnu?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            tebnu is a community for getting help and offering help — for any
            need, big or small.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 space-y-2 text-sm text-foreground/90">
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Find help near you (services, one-time tasks, ongoing support).
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Offer your skills and connect with people who need them.
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Share updates, reviews, and availability on the public board.
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Message securely and build trust through community activity.
          </li>
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/10">
            <img
              src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
              alt=""
              className="h-auto w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-3.5 shadow-md ring-1 ring-black/5">
              <img
                src={BRAND_LOGO_SRC}
                alt="Tebnu"
                className="h-9 w-auto"
                loading="eager"
                decoding="async"
              />
              <span className="text-[13px] font-black tracking-tight text-slate-900">
                Tebnu.com
              </span>
            </div>
          </div>
          <Button
            type="button"
            className={cn(
              "h-11 w-full rounded-xl text-[15px] font-black",
              TEBNU_JOIN_COMMUNITY_BUTTON_CLASS,
            )}
            onClick={() => {
              onOpenChange(false);
              navigate("/onboarding");
            }}
          >
            Register
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl text-[15px] font-semibold"
            onClick={() => {
              onOpenChange(false);
              navigate("/login");
            }}
          >
            Sign in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
