import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { getCityFromLocation } from "@/lib/location";
import type { LocationRadiusValue } from "@/components/LocationRadiusPicker";

export function useClientProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [shareTelegram, setShareTelegram] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [isAvailableForJobs, setIsAvailableForJobs] = useState(false);
  const [locationRadius, setLocationRadius] = useState<LocationRadiusValue>({
    address: "",
    radius: 10,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setCity(profile.city || "");
      setPhone(profile.phone || "");
      setPhotoUrl(profile.photo_url || null);
      setWhatsappNumber(profile.whatsapp_number_e164 || "");
      setTelegramUsername(profile.telegram_username || "");
      setShareWhatsapp(profile.share_whatsapp || false);
      setShareTelegram(profile.share_telegram || false);
      setCategories(profile.categories || []);
      setIsAvailableForJobs(profile.is_available_for_jobs || false);
      setLocationRadius({
        address: (profile as any).address || "",
        lat: (profile as any).location_lat ?? undefined,
        lng: (profile as any).location_lng ?? undefined,
        radius: (profile as any).service_radius ?? 10,
      });
    }
  }, [profile]);

  const normalizePhoneNumber = (phone: string): string | null => {
    if (!phone.trim()) return null;
    let cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned.startsWith("+")) {
      if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
      cleaned = "+972" + cleaned;
    }
    return cleaned;
  };

  const normalizeTelegramUsername = (username: string): string | null => {
    if (!username.trim()) return null;
    let cleaned = username.trim();
    if (cleaned.startsWith("@")) cleaned = cleaned.substring(1);
    return cleaned;
  };

  async function handleImageUploadFile(file: File) {
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      addToast({ title: "Invalid file type", description: "Please upload an image file", variant: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: "File too large", description: "Please upload an image smaller than 5MB", variant: "error" });
      return;
    }

    setUploading(true);
    try {
      if (photoUrl) {
        const oldPath = photoUrl.split("/").pop();
        if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
      }
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setPhotoUrl(data.publicUrl);
      addToast({ title: "Photo uploaded", description: "Don't forget to save your changes", variant: "success" });
    } catch (error: any) {
      addToast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImageUploadFile(file);
  }

  async function handleRemovePhoto() {
    if (!photoUrl || !user) return;
    try {
      const fileName = photoUrl.split("/").pop();
      if (fileName) await supabase.storage.from("avatars").remove([fileName]);
      setPhotoUrl(null);
      addToast({ title: "Photo removed", description: "Don't forget to save your changes", variant: "info" });
    } catch (error: any) {
      addToast({ title: "Failed to remove photo", description: error.message || "Please try again", variant: "error" });
    }
  }

  async function handleGetLocation() {
    setGettingLocation(true);
    try {
      const cityName = await getCityFromLocation();
      setCity(cityName);
      addToast({ title: "Location found", description: `Your location has been set to ${cityName}`, variant: "success" });
    } catch (error: any) {
      addToast({ title: "Location error", description: error.message || "Failed to get your location", variant: "error" });
    } finally {
      setGettingLocation(false);
    }
  }

  async function handleSave(): Promise<boolean> {
    if (!user) return false;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        role: profile?.role || "client",
        full_name: fullName.trim(),
        city: city.trim(),
        phone: phone.trim() || null,
        photo_url: photoUrl,
        whatsapp_number_e164: normalizePhoneNumber(whatsappNumber),
        telegram_username: normalizeTelegramUsername(telegramUsername),
        share_whatsapp: shareWhatsapp,
        share_telegram: shareTelegram,
        categories: categories,
        is_available_for_jobs: isAvailableForJobs,
        address: locationRadius.address || null,
        location_lat: locationRadius.lat ?? null,
        location_lng: locationRadius.lng ?? null,
        service_radius: locationRadius.radius,
      });
      if (error) throw error;
      await refreshProfile();
      addToast({ title: "Profile updated", description: "Your changes have been saved successfully", variant: "success" });
      return true;
    } catch (error: any) {
      addToast({ title: "Save failed", description: error.message || "Failed to save profile", variant: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    profile,
    fileInputRef,
    fullName,
    setFullName,
    city,
    setCity,
    phone,
    setPhone,
    photoUrl,
    uploading,
    saving,
    gettingLocation,
    whatsappNumber,
    setWhatsappNumber,
    telegramUsername,
    setTelegramUsername,
    shareWhatsapp,
    setShareWhatsapp,
    shareTelegram,
    setShareTelegram,
    categories,
    setCategories,
    isAvailableForJobs,
    setIsAvailableForJobs,
    locationRadius,
    setLocationRadius,
    handleImageUploadFile,
    handleImageUpload,
    handleRemovePhoto,
    handleGetLocation,
    handleSave,
  };
}

export type ClientProfileFormContext = ReturnType<typeof useClientProfileForm>;
