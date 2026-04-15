import { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import {
  ServiceCategoriesPicker,
  serviceLabelsForIds,
} from "@/components/ServiceCategoriesPicker";
import {
  LocationRadiusPicker,
  type LocationRadiusValue,
} from "@/components/LocationRadiusPicker";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Snapshot = {
  categories: string[];
  locationRadius: LocationRadiusValue;
};

function summarizeArea(r: LocationRadiusValue): string {
  const place = r.address?.trim();
  if (place && place.length > 0) {
    const short = place.length > 48 ? `${place.slice(0, 45)}…` : place;
    return `${r.radius} km · ${short}`;
  }
  return `${r.radius} km — tap Edit to place your pin on the map`;
}

export default function FreelancerProfileServicesPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();
  const [editing, setEditing] = useState(false);
  const snapshotRef = useRef<Snapshot | null>(null);

  function beginEdit() {
    snapshotRef.current = {
      categories: [...ctx.categories],
      locationRadius: { ...ctx.locationRadius },
    };
    setEditing(true);
  }

  function cancelEdit() {
    const s = snapshotRef.current;
    if (s) {
      ctx.setCategories(s.categories);
      ctx.setLocationRadius(s.locationRadius);
    }
    setEditing(false);
  }

  async function saveAndClose() {
    const ok = await ctx.handleSave();
    if (ok) setEditing(false);
  }

  return (
    <ProfileSubpageLayout
      title="Services & area"
      description="What you offer and where you're willing to work"
    >
      <div className="space-y-8">
        <div className="flex justify-end">
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-border/60"
              onClick={beginEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={cancelEdit}
                disabled={ctx.saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={saveAndClose}
                disabled={ctx.saving}
              >
                {ctx.saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="space-y-2">
            <div
              className={cn(
                "rounded-2xl border border-border/40 bg-card/30 px-4 py-5 sm:px-6",
                "shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Categories
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                {serviceLabelsForIds(ctx.categories)}
              </p>
            </div>

            <div
              className={cn(
                "rounded-2xl border border-border/40 bg-card/30 px-4 py-5 sm:px-6",
                "shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Service area
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                {summarizeArea(ctx.locationRadius)}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Radius from your location
              </p>
            </div>

            <p className="text-center text-[13px] text-muted-foreground">
              Tap Edit to change services or area
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Categories
              </p>
              <ServiceCategoriesPicker
                selectedCategories={ctx.categories}
                onChange={ctx.setCategories}
              />
            </div>

            <div className="border-t border-border/35 pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Service area
              </p>
              <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
                Radius from your location
              </p>
              <LocationRadiusPicker
                value={ctx.locationRadius}
                onChange={ctx.setLocationRadius}
                variant="minimal"
              />
            </div>
          </div>
        )}
      </div>
    </ProfileSubpageLayout>
  );
}
