import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

// Optional field constants
const HOME_SIZES = [
  { id: "1_2_rooms", label: "1-2 rooms", icon: "🏠" },
  { id: "2_4_rooms", label: "2-4 rooms", icon: "🏡" },
  { id: "4_6_rooms", label: "4-6 rooms", icon: "🏘️" },
  { id: "6_plus_rooms", label: "6+ rooms", icon: "🏰" },
];

const COOKING_WHO_FOR = [
  { id: "kids", label: "Kids", icon: "👶" },
  { id: "young_adults", label: "Young Adults", icon: "🧑" },
  { id: "adults", label: "Adults", icon: "👨" },
];

const DELIVERY_WEIGHTS = [
  { id: "small", label: "Small (up to 2kg)", icon: "📦" },
  { id: "medium", label: "Medium (2-5kg)", icon: "📦" },
  { id: "big", label: "Big (5-10kg)", icon: "📦" },
  { id: "heavy", label: "Heavy (10kg+)", icon: "📦" },
];

const NANNY_AGE_GROUPS = [
  { id: "1_3_years", label: "1-3 years old", icon: "👶" },
  { id: "3_5_years", label: "3-5 years old", icon: "🧒" },
  { id: "5_10_years", label: "5-10 years old", icon: "👦" },
  { id: "10_plus_years", label: "10+ years old", icon: "🧑" },
];

const MOBILITY_LEVELS = [
  { id: "no_disability", label: "No Disability", icon: "🚶" },
  { id: "some_disability", label: "Some Disability", icon: "🦯" },
  { id: "disabled", label: "Disabled", icon: "♿" },
];

interface JobFollowUpModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  serviceType: string;
  otherType?: string;
}

export default function JobFollowUpModal({
  open,
  onClose,
  jobId,
  serviceType,
  otherType,
}: JobFollowUpModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<
    Record<string, string>
  >({});

  const handleSubmit = async () => {
    if (Object.keys(selectedDetails).length === 0) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await apiPost(`/jobs/${jobId}/details`, {
        service_details: selectedDetails,
      });
      onClose();
    } catch (error) {
      console.error("Error updating job details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (key: string, value: string) => {
    setSelectedDetails((prev) => ({ ...prev, [key]: value }));
  };

  const renderServiceSpecificQuestions = () => {
    switch (serviceType) {
      case "cleaning":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Size of home (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {HOME_SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => handleSelect("home_size", size.id)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left text-sm",
                      selectedDetails.home_size === size.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="text-xl">{size.icon}</span>
                    <span>{size.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "cooking":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Who is this for? (optional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COOKING_WHO_FOR.map((who) => (
                  <button
                    key={who.id}
                    onClick={() => handleSelect("who_for", who.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm",
                      selectedDetails.who_for === who.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="text-2xl">{who.icon}</span>
                    <span>{who.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "pickup_delivery":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Package weight (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_WEIGHTS.map((weight) => (
                  <button
                    key={weight.id}
                    onClick={() => handleSelect("weight", weight.id)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left text-sm",
                      selectedDetails.weight === weight.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="text-xl">{weight.icon}</span>
                    <span>{weight.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "nanny":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Age group (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {NANNY_AGE_GROUPS.map((age) => (
                  <button
                    key={age.id}
                    onClick={() => handleSelect("age_group", age.id)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left text-sm",
                      selectedDetails.age_group === age.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="text-xl">{age.icon}</span>
                    <span>{age.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "other_help":
        if (otherType === "caregiving") {
          return (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Mobility level (optional)
                </label>
                <div className="grid gap-2">
                  {MOBILITY_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => handleSelect("mobility_level", level.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left text-sm",
                        selectedDetails.mobility_level === level.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <span className="text-xl">{level.icon}</span>
                      <span>{level.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        return null;

      default:
        return null;
    }
  };

  const hasQuestions =
    serviceType === "cleaning" ||
    serviceType === "cooking" ||
    serviceType === "pickup_delivery" ||
    serviceType === "nanny" ||
    (serviceType === "other_help" && otherType === "caregiving");

  if (!hasQuestions) {
    // No questions for this service type, close immediately
    if (open) {
      setTimeout(() => onClose(), 0);
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Enhance Your Job Request
          </DialogTitle>
          <DialogDescription>
            Add a few more details to help freelancers better understand your
            needs. This is optional!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderServiceSpecificQuestions()}</div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={loading || Object.keys(selectedDetails).length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Add Details
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
