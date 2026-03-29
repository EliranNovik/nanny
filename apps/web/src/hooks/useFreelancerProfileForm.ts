import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { getCityFromLocation } from "@/lib/location";
import type { LocationRadiusValue } from "@/components/LocationRadiusPicker";

export interface FreelancerData {
  bio: string;
  languages: string[];
  has_first_aid: boolean;
  newborn_experience: boolean;
  special_needs_experience: boolean;
  max_children: number;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  available_now: boolean;
  availability_note: string;
}

export type RateMode = "single" | "range";

export const FREELANCER_LANGUAGES = ["Hebrew", "English", "Russian", "Arabic", "French", "Spanish"];

export function useFreelancerProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateMode, setRateMode] = useState<RateMode>("single");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [shareTelegram, setShareTelegram] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [locationRadius, setLocationRadius] = useState<LocationRadiusValue>({
    address: "",
    radius: 10,
  });
  const hasFetchedRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  const [data, setData] = useState<FreelancerData>({
    bio: "",
    languages: [],
    has_first_aid: false,
    newborn_experience: false,
    special_needs_experience: false,
    max_children: 2,
    hourly_rate_min: null,
    hourly_rate_max: null,
    available_now: false,
    availability_note: "",
  });

  useEffect(() => {
    if (profile) {
      setPhotoUrl(profile.photo_url || null);
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCity(profile.city || "");
      setWhatsappNumber(profile.whatsapp_number_e164 || "");
      setTelegramUsername(profile.telegram_username || "");
      setShareWhatsapp(profile.share_whatsapp || false);
      setShareTelegram(profile.share_telegram || false);
      setCategories(profile.categories || []);
      setLocationRadius({
        address: (profile as any).address || "",
        lat: (profile as any).location_lat ?? undefined,
        lng: (profile as any).location_lng ?? undefined,
        radius: (profile as any).service_radius ?? 10,
      });
    }
  }, [profile]);

  const fetchFreelancerProfile = async (userId: string) => {
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    try {
      const { data: freelancerProfile, error } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("[FreelancerProfile] Error fetching freelancer profile:", error);
        return;
      }

      if (!freelancerProfile) {
        navigate("/onboarding?role=freelancer", { replace: true });
        return;
      }

      setData({
        bio: freelancerProfile.bio || "",
        languages: freelancerProfile.languages || [],
        has_first_aid: freelancerProfile.has_first_aid,
        newborn_experience: freelancerProfile.newborn_experience,
        special_needs_experience: freelancerProfile.special_needs_experience,
        max_children: freelancerProfile.max_children,
        hourly_rate_min: freelancerProfile.hourly_rate_min,
        hourly_rate_max: freelancerProfile.hourly_rate_max,
        available_now: freelancerProfile.available_now,
        availability_note: freelancerProfile.availability_note || "",
      });

      if (
        freelancerProfile.hourly_rate_min !== null &&
        freelancerProfile.hourly_rate_max !== null &&
        freelancerProfile.hourly_rate_min !== freelancerProfile.hourly_rate_max
      ) {
        setRateMode("range");
      } else {
        setRateMode("single");
      }
    } catch (err: any) {
      console.error("[FreelancerProfile] Exception fetching profile:", err);
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      hasFetchedRef.current = null;
      return;
    }

    if (hasFetchedRef.current === user.id) {
      setLoading(false);
      return;
    }

    if (typeof document !== "undefined" && document.hidden) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchFreelancerProfile(user.id).finally(() => {
      if (!cancelled) {
        setLoading(false);
        hasFetchedRef.current = user.id;
      }
    });

    return () => {
      cancelled = true;
      if (hasFetchedRef.current !== user.id) {
        hasFetchedRef.current = null;
      }
    };
  }, [user?.id]);

  function updateField<K extends keyof FreelancerData>(field: K, value: FreelancerData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleLanguage(lang: string) {
    setData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang) ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang],
    }));
  }

  async function handleImageUploadFile(file: File) {
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "error",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "error",
      });
      return;
    }

    setUploading(true);

    try {
      if (photoUrl) {
        const oldPath = photoUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setPhotoUrl(urlData.publicUrl);

      addToast({
        title: "Photo uploaded",
        description: "Don't forget to save your changes",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      addToast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "error",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      if (fileName) {
        await supabase.storage.from("avatars").remove([fileName]);
      }
      setPhotoUrl(null);
      addToast({
        title: "Photo removed",
        description: "Don't forget to save your changes",
        variant: "info",
      });
    } catch (error: any) {
      console.error("Error removing image:", error);
      addToast({
        title: "Failed to remove photo",
        description: error.message || "Please try again",
        variant: "error",
      });
    }
  }

  async function handleGetLocation() {
    setGettingLocation(true);
    try {
      const cityName = await getCityFromLocation();
      setCity(cityName);
      addToast({
        title: "Location found",
        description: `Your location has been set to ${cityName}`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error getting location:", error);
      addToast({
        title: "Location error",
        description: error.message || "Failed to get your location",
        variant: "error",
      });
    } finally {
      setGettingLocation(false);
    }
  }

  const normalizePhoneNumber = (phone: string): string | null => {
    if (!phone.trim()) return null;
    let cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned.startsWith("+")) {
      if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
      }
      cleaned = "+972" + cleaned;
    }
    return cleaned;
  };

  const normalizeTelegramUsername = (username: string): string | null => {
    if (!username.trim()) return null;
    let cleaned = username.trim();
    if (cleaned.startsWith("@")) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  async function handleSave(): Promise<boolean> {
    if (!user) return false;
    setSaving(true);

    try {
      const { error: freelancerError } = await supabase.from("freelancer_profiles").upsert({
        user_id: user.id,
        ...data,
      });

      if (freelancerError) {
        console.error("[FreelancerProfile] Error saving freelancer profile:", freelancerError);
        throw freelancerError;
      }

      const profileUpdates: Record<string, unknown> = {};
      if (photoUrl !== (profile?.photo_url || null)) {
        profileUpdates.photo_url = photoUrl;
      }
      if (fullName !== (profile?.full_name || "")) {
        profileUpdates.full_name = fullName.trim();
      }
      if (phone !== (profile?.phone || "")) {
        profileUpdates.phone = phone.trim() || null;
      }
      if (city !== (profile?.city || "")) {
        profileUpdates.city = city.trim();
      }

      const normalizedWhatsapp = normalizePhoneNumber(whatsappNumber);
      if (normalizedWhatsapp !== (profile?.whatsapp_number_e164 || null)) {
        profileUpdates.whatsapp_number_e164 = normalizedWhatsapp;
      }
      const normalizedTelegram = normalizeTelegramUsername(telegramUsername);
      if (normalizedTelegram !== (profile?.telegram_username || null)) {
        profileUpdates.telegram_username = normalizedTelegram;
      }
      if (shareWhatsapp !== (profile?.share_whatsapp || false)) {
        profileUpdates.share_whatsapp = shareWhatsapp;
      }
      if (shareTelegram !== (profile?.share_telegram || false)) {
        profileUpdates.share_telegram = shareTelegram;
      }
      if (JSON.stringify(categories) !== JSON.stringify(profile?.categories || [])) {
        profileUpdates.categories = categories;
      }
      profileUpdates.address = locationRadius.address || null;
      profileUpdates.location_lat = locationRadius.lat ?? null;
      profileUpdates.location_lng = locationRadius.lng ?? null;
      profileUpdates.service_radius = locationRadius.radius;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          role: profile?.role || "freelancer",
          ...profileUpdates,
        });

        if (profileError) {
          console.error("[FreelancerProfile] Error saving profile info:", profileError);
          throw profileError;
        }
      }

      await refreshProfile();

      if (user) {
        hasFetchedRef.current = null;
        await fetchFreelancerProfile(user.id);
        hasFetchedRef.current = user.id;
      }

      addToast({
        title: "Profile saved",
        description: "Your freelancer profile has been updated successfully",
        variant: "success",
      });
      return true;
    } catch (err: any) {
      console.error("[FreelancerProfile] Failed to save:", err);
      const errorMessage = err?.message || "Failed to save profile. Please try again.";
      addToast({
        title: "Save failed",
        description: errorMessage,
        variant: "error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    profile,
    fileInputRef,
    loading,
    saving,
    rateMode,
    setRateMode,
    photoUrl,
    uploading,
    fullName,
    setFullName,
    phone,
    setPhone,
    city,
    setCity,
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
    locationRadius,
    setLocationRadius,
    data,
    updateField,
    toggleLanguage,
    handleImageUploadFile,
    handleImageUpload,
    handleRemovePhoto,
    handleGetLocation,
    handleSave,
  };
}

export type FreelancerProfileFormContext = ReturnType<typeof useFreelancerProfileForm>;
