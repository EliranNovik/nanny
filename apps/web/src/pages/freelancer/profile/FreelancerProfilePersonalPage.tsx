import { useRef, useState, type ChangeEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ViewEditFieldRow } from "@/components/profile/ViewEditFieldRow";
import { ProfileImageCropModal } from "@/components/profile/ProfileImageCropModal";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, Camera, X, Navigation, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const inputEdit =
  "w-full border border-border/60 bg-background/80 rounded-lg px-3 py-2.5 text-[15px] shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

type Snapshot = {
  fullName: string;
  city: string;
  phone: string;
  whatsappNumber: string;
  telegramUsername: string;
  shareWhatsapp: boolean;
  shareTelegram: boolean;
};

export default function FreelancerProfilePersonalPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();
  const [editing, setEditing] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const snapshotRef = useRef<Snapshot | null>(null);

  function beginEdit() {
    snapshotRef.current = {
      fullName: ctx.fullName,
      city: ctx.city,
      phone: ctx.phone,
      whatsappNumber: ctx.whatsappNumber,
      telegramUsername: ctx.telegramUsername,
      shareWhatsapp: ctx.shareWhatsapp,
      shareTelegram: ctx.shareTelegram,
    };
    setEditing(true);
  }

  function cancelEdit() {
    const s = snapshotRef.current;
    if (s) {
      ctx.setFullName(s.fullName);
      ctx.setCity(s.city);
      ctx.setPhone(s.phone);
      ctx.setWhatsappNumber(s.whatsappNumber);
      ctx.setTelegramUsername(s.telegramUsername);
      ctx.setShareWhatsapp(s.shareWhatsapp);
      ctx.setShareTelegram(s.shareTelegram);
    }
    setEditing(false);
  }

  async function saveAndClose() {
    const ok = await ctx.handleSave();
    if (ok) setEditing(false);
  }

  const dash = (v: string) => (v.trim() ? v : "—");

  const initials =
    ctx.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  function onChoosePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      ctx.handleImageUpload(e);
      return;
    }
    setCropFile(file);
    setCropOpen(true);
    if (ctx.fileInputRef.current) ctx.fileInputRef.current.value = "";
  }

  return (
    <ProfileSubpageLayout
      title="Personal & contact"
      description="How you appear and how others can reach you"
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
                disabled={ctx.saving || ctx.uploading}
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

        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border border-border/50">
              <AvatarImage src={ctx.photoUrl || undefined} />
              <AvatarFallback className="bg-muted text-2xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {editing && ctx.photoUrl && (
              <button
                type="button"
                onClick={ctx.handleRemovePhoto}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/90"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <input
            ref={ctx.fileInputRef}
            type="file"
            accept="image/*"
            onChange={onChoosePhoto}
            className="hidden"
            disabled={ctx.uploading}
          />
          {editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => ctx.fileInputRef.current?.click()}
              disabled={ctx.uploading}
            >
              {ctx.uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  {ctx.photoUrl ? "Change photo" : "Upload photo"}
                </>
              )}
            </Button>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl border border-border/40 bg-card/30 px-4 py-2 sm:px-6",
            !editing &&
              "shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          <ViewEditFieldRow
            label="Full name"
            editing={editing}
            viewContent={dash(ctx.fullName)}
            editContent={
              <>
                <Label
                  htmlFor="fullName"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Full name
                </Label>
                <Input
                  id="fullName"
                  placeholder="Your name"
                  className={inputEdit}
                  value={ctx.fullName}
                  onChange={(e) => ctx.setFullName(e.target.value)}
                />
              </>
            }
          />

          <ViewEditFieldRow
            label="Phone"
            editing={editing}
            viewContent={
              <span className="text-muted-foreground">
                {ctx.phone.trim() ? ctx.phone : "Not added"}
              </span>
            }
            editContent={
              <>
                <Label
                  htmlFor="phone"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Phone (optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+972 50-123-4567"
                  className={inputEdit}
                  value={ctx.phone}
                  onChange={(e) => ctx.setPhone(e.target.value)}
                />
              </>
            }
          />

          <ViewEditFieldRow
            label="City"
            editing={editing}
            viewContent={dash(ctx.city)}
            editContent={
              <>
                <Label
                  htmlFor="city"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  City
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="city"
                    placeholder="e.g., Tel Aviv"
                    className={cn(inputEdit, "flex-1")}
                    value={ctx.city}
                    onChange={(e) => ctx.setCity(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg"
                    onClick={ctx.handleGetLocation}
                    disabled={ctx.gettingLocation}
                  >
                    {ctx.gettingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use GPS to detect your city
                </p>
              </>
            }
          />
        </div>

        <div
          className={cn(
            "rounded-2xl border border-border/40 bg-card/30 px-4 py-2 sm:px-6",
            !editing &&
              "shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          <ViewEditFieldRow
            label="WhatsApp"
            editing={editing}
            viewContent={
              <div>
                <p>{dash(ctx.whatsappNumber)}</p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Share with matched users:{" "}
                  <span className="text-foreground/80">
                    {ctx.shareWhatsapp ? "On" : "Off"}
                  </span>
                </p>
              </div>
            }
            editContent={
              <>
                <Label
                  htmlFor="whatsapp"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  WhatsApp (optional)
                </Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="+972 50-123-4567"
                  className={inputEdit}
                  value={ctx.whatsappNumber}
                  onChange={(e) => ctx.setWhatsappNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  International format
                </p>
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="share-whatsapp"
                      className="text-sm font-medium"
                    >
                      Share WhatsApp with matched users
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow contact on WhatsApp
                    </p>
                  </div>
                  <Switch
                    id="share-whatsapp"
                    checked={ctx.shareWhatsapp}
                    onCheckedChange={ctx.setShareWhatsapp}
                    disabled={!ctx.whatsappNumber.trim()}
                  />
                </div>
              </>
            }
          />

          <ViewEditFieldRow
            label="Telegram"
            editing={editing}
            viewContent={
              <div>
                <p>
                  {ctx.telegramUsername.trim()
                    ? `@${ctx.telegramUsername.replace(/^@/, "")}`
                    : "—"}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Share with matched users:{" "}
                  <span className="text-foreground/80">
                    {ctx.shareTelegram ? "On" : "Off"}
                  </span>
                </p>
              </div>
            }
            editContent={
              <>
                <Label
                  htmlFor="telegram"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Telegram (optional)
                </Label>
                <Input
                  id="telegram"
                  type="text"
                  placeholder="username (without @)"
                  className={inputEdit}
                  value={ctx.telegramUsername}
                  onChange={(e) => ctx.setTelegramUsername(e.target.value)}
                />
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="share-telegram"
                      className="text-sm font-medium"
                    >
                      Share Telegram with matched users
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow contact on Telegram
                    </p>
                  </div>
                  <Switch
                    id="share-telegram"
                    checked={ctx.shareTelegram}
                    onCheckedChange={ctx.setShareTelegram}
                    disabled={!ctx.telegramUsername.trim()}
                  />
                </div>
              </>
            }
          />
        </div>

        {!editing && (
          <p className="text-center text-[13px] text-muted-foreground">
            Tap Edit to update your details
          </p>
        )}
      </div>
      <ProfileImageCropModal
        file={cropFile}
        open={cropOpen}
        onCancel={() => {
          setCropOpen(false);
          setCropFile(null);
        }}
        onConfirm={async (file) => {
          await ctx.handleImageUploadFile(file);
          setCropOpen(false);
          setCropFile(null);
        }}
      />
    </ProfileSubpageLayout>
  );
}
