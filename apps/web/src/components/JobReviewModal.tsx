import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

interface JobReviewModalProps {
  open: boolean;
  jobId: string;
  reviewee: Profile;
  revieweeRole: "client" | "freelancer";
  onClose: () => void;
  onConfirmed: () => void; // called after the job is finally marked complete
}

export default function JobReviewModal({
  open,
  jobId,
  reviewee,
  revieweeRole,
  onClose,
  onConfirmed,
}: JobReviewModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (skip = false) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // 1. Save review (if not skipping)
      if (!skip && rating > 0) {
        const { error: reviewError } = await supabase
          .from("job_reviews")
          .insert({
            job_id: jobId,
            reviewer_id: user.id,
            reviewee_id: reviewee.id,
            rating,
            review_text: reviewText.trim() || null,
          });
        if (reviewError) throw reviewError;
      }

      // 2. Mark job as completed
      const { error: jobError } = await supabase
        .from("job_requests")
        .update({ status: "completed" })
        .eq("id", jobId);
      if (jobError) throw jobError;

      setDone(true);
      setTimeout(() => {
        onConfirmed();
        onClose();
        setDone(false);
        setRating(0);
        setReviewText("");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const starLabel = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        {/* Header gradient banner */}
        <div className="px-6 pt-8 pb-6 bg-gradient-to-br from-primary/10 via-background to-background text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-1">
              Rate your experience
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              How was working with this {revieweeRole}?
            </DialogDescription>
          </DialogHeader>

          {/* Avatar */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <Avatar className="w-20 h-20 border-4 border-background shadow-lg">
              <AvatarImage
                src={reviewee.photo_url || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">
                {reviewee.full_name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <p className="font-bold text-lg text-foreground leading-tight">
              {reviewee.full_name || "User"}
            </p>
            <p className="text-xs text-muted-foreground capitalize font-medium">
              {revieweeRole}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 animate-bounce" />
              <p className="text-lg font-bold text-emerald-600">
                Review saved!
              </p>
              <p className="text-sm text-muted-foreground">
                Marking job as completed…
              </p>
            </div>
          ) : (
            <>
              {/* Stars */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className={cn(
                        "inline-flex items-center justify-center w-11 h-11 rounded-full transition-transform duration-150 focus:outline-none active:scale-90",
                        (hovered || rating) >= star ? "scale-110" : "scale-100",
                      )}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={cn(
                          "w-8 h-8 transition-colors duration-150",
                          (hovered || rating) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30 fill-transparent",
                        )}
                      />
                    </button>
                  ))}
                </div>
                <span
                  className={cn(
                    "h-5 text-sm font-semibold text-amber-500 transition-opacity duration-100 select-none",
                    hovered > 0 || rating > 0
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none",
                  )}
                >
                  {starLabel[hovered || rating] || "\u00a0"}
                </span>
              </div>

              {/* Review text */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Leave a comment{" "}
                  <span className="text-xs opacity-60">(optional)</span>
                </label>
                <Textarea
                  placeholder="Share details about your experience…"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="resize-none min-h-[90px] text-sm rounded-xl border-border/60 focus:border-primary focus:ring-1 focus:ring-primary"
                  maxLength={500}
                />
                {reviewText.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    {reviewText.length}/500
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                  disabled={saving || rating === 0}
                  onClick={() => handleSubmit(false)}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Submit Review & Complete Job
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
                  disabled={saving}
                  onClick={() => handleSubmit(true)}
                >
                  Skip review & mark done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
