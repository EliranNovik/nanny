import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Save, 
  Bell,
  Globe,
  DollarSign,
  Baby,
  Heart,
  Shield,
  CheckCircle2,
  Loader2,
  Camera,
  X,
  Navigation
} from "lucide-react";
import { getCityFromLocation } from "@/lib/location";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface FreelancerData {
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

type RateMode = "single" | "range";

const LANGUAGES = ["Hebrew", "English", "Russian", "Arabic", "French", "Spanish"];

export default function FreelancerProfilePage() {
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
    // Load photo and basic info from user profile
    if (profile) {
      setPhotoUrl(profile.photo_url || null);
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCity(profile.city || "");
    }
  }, [profile]);

  // Function to fetch freelancer profile data
  const fetchFreelancerProfile = async (userId: string) => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      console.log("[FreelancerProfilePage] Fetch already in progress, skipping");
      return;
    }

    fetchingRef.current = true;
    try {
      console.log("[FreelancerProfilePage] Fetching freelancer profile for user", userId);
      const { data: freelancerProfile, error } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("[FreelancerProfilePage] Error fetching freelancer profile:", error);
        return;
      }

      // If no freelancer_profiles entry exists, redirect to onboarding
      if (!freelancerProfile) {
        console.log("[FreelancerProfilePage] No freelancer_profiles found, redirecting to onboarding");
        navigate("/onboarding", { replace: true });
        return;
      }

      // Profile exists, load data
      console.log("[FreelancerProfilePage] Profile loaded successfully");
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
      
      // Determine rate mode based on existing data
      if (freelancerProfile.hourly_rate_min !== null && freelancerProfile.hourly_rate_max !== null && freelancerProfile.hourly_rate_min !== freelancerProfile.hourly_rate_max) {
        setRateMode("range");
      } else {
        setRateMode("single");
      }
    } catch (err: any) {
      console.error("[FreelancerProfilePage] Exception fetching profile:", err);
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

    // Only fetch once per user, unless explicitly refetched
    // This prevents constant refetching when switching browsers/tabs
    if (hasFetchedRef.current === user.id) {
      setLoading(false);
      return;
    }

    // Don't fetch if tab is hidden (user switched to another tab/browser)
    if (typeof document !== "undefined" && document.hidden) {
      console.log("[FreelancerProfilePage] Tab is hidden, deferring fetch");
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
      // Reset fetch ref if user changes
      if (hasFetchedRef.current !== user.id) {
        hasFetchedRef.current = null;
      }
    };
  }, [user?.id]); // Only depend on user.id, not the whole user object or navigate

  function updateField<K extends keyof FreelancerData>(field: K, value: FreelancerData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleLanguage(lang: string) {
    setData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "error",
      });
      return;
    }

    // Validate file size (max 5MB)
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
      // Delete old avatar if exists
      if (photoUrl) {
        const oldPath = photoUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setPhotoUrl(data.publicUrl);

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
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    try {
      console.log("[FreelancerProfilePage] Saving profile:", {
        user_id: user.id,
        available_now: data.available_now,
        max_children: data.max_children
      });

      // Save freelancer profile data
      const { error: freelancerError } = await supabase.from("freelancer_profiles").upsert({
        user_id: user.id,
        ...data,
      });

      if (freelancerError) {
        console.error("[FreelancerProfilePage] Error saving freelancer profile:", freelancerError);
        throw freelancerError;
      }

      // Save profile info (photo, name, phone, city) to profiles table
      const profileUpdates: any = {};
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

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          role: profile?.role || "freelancer", // Preserve existing role
          ...profileUpdates,
        });

        if (profileError) {
          console.error("[FreelancerProfilePage] Error saving profile info:", profileError);
          throw profileError;
        }
      }

      // Refresh both profile and freelancer profile data
      await refreshProfile();
      
      // Refetch freelancer profile data to update the form
      // Reset the fetch ref to force a refetch
      if (user) {
        hasFetchedRef.current = null;
        await fetchFreelancerProfile(user.id);
        hasFetchedRef.current = user.id;
      }

      console.log("[FreelancerProfilePage] Profile saved successfully");
      addToast({
        title: "Profile saved",
        description: "Your freelancer profile has been updated successfully",
        variant: "success",
      });
    } catch (err: any) {
      console.error("[FreelancerProfilePage] Failed to save:", err);
      const errorMessage = err?.message || "Failed to save profile. Please try again.";
      addToast({
        title: "Save failed",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Profile</h1>
            <p className="text-muted-foreground">
              Complete your profile to get matched with families
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate("/freelancer/notifications")}
            className="gap-2"
          >
            <Bell className="w-4 h-4" />
            Notifications
          </Button>
        </div>

        <div className="space-y-6 animate-stagger">
          {/* Profile Picture & Basic Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-primary/20">
                    <AvatarImage src={photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                      {fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {photoUrl && (
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="avatar-upload"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        {photoUrl ? "Change Photo" : "Upload Photo"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+972 50-123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* City with GPS */}
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <div className="flex gap-2">
                  <Input
                    id="city"
                    placeholder="e.g., Tel Aviv"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGetLocation}
                    disabled={gettingLocation}
                    title="Get location using GPS"
                  >
                    {gettingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the GPS icon to automatically detect your location
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Availability Toggle */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className={cn(
              "p-6 transition-colors",
              data.available_now ? "bg-emerald-500/10" : "bg-muted"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    data.available_now ? "bg-emerald-500" : "bg-muted-foreground/20"
                  )}>
                    {data.available_now ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <Bell className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {data.available_now ? "You're Available!" : "Not Available"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {data.available_now 
                        ? "You'll receive job notifications"
                        : "Toggle on to receive job requests"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={data.available_now}
                  onCheckedChange={(checked) => updateField("available_now", checked)}
                />
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>About You</CardTitle>
              <CardDescription>Tell families about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  className="mt-1.5 flex min-h-[100px] w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Share your experience, what you love about childcare, etc."
                  value={data.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={cn(
                      "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                      data.languages.includes(lang)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Experience & Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium">First Aid Certified</p>
                    <p className="text-sm text-muted-foreground">CPR & First Aid training</p>
                  </div>
                </div>
                <Switch
                  checked={data.has_first_aid}
                  onCheckedChange={(checked) => updateField("has_first_aid", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-pink-500" />
                  <div>
                    <p className="font-medium">Newborn Experience</p>
                    <p className="text-sm text-muted-foreground">Care for 0-6 month olds</p>
                  </div>
                </div>
                <Switch
                  checked={data.newborn_experience}
                  onCheckedChange={(checked) => updateField("newborn_experience", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Special Needs Experience</p>
                    <p className="text-sm text-muted-foreground">Experience with special needs children</p>
                  </div>
                </div>
                <Switch
                  checked={data.special_needs_experience}
                  onCheckedChange={(checked) => updateField("special_needs_experience", checked)}
                />
              </div>

              <div className="pt-2">
                <Label>Maximum Children</Label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => updateField("max_children", num)}
                      className={cn(
                        "w-12 h-12 rounded-lg border-2 font-semibold transition-all",
                        data.max_children === num
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {num === 4 ? "4+" : num}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rates */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Hourly Rate
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    rateMode === "single" ? "text-muted-foreground" : "text-foreground"
                  )}>
                    Single
                  </span>
                  <Switch
                    checked={rateMode === "range"}
                    onCheckedChange={(checked) => {
                      const newMode = checked ? "range" : "single";
                      setRateMode(newMode);
                      // When switching to single, set both min and max to the same value
                      if (newMode === "single" && data.hourly_rate_min !== null) {
                        updateField("hourly_rate_max", data.hourly_rate_min);
                      } else if (newMode === "single" && data.hourly_rate_max !== null) {
                        updateField("hourly_rate_min", data.hourly_rate_max);
                      }
                    }}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    rateMode === "range" ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Range
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rateMode === "single" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Hourly Rate</span>
                    <span className="text-2xl font-bold text-primary">
                      ₪{data.hourly_rate_min || data.hourly_rate_max || 50}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={5}
                      value={data.hourly_rate_min || data.hourly_rate_max || 50}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateField("hourly_rate_min", value);
                        updateField("hourly_rate_max", value);
                      }}
                      className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>₪20</span>
                      <span>₪200</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Min Rate Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Minimum Rate</span>
                      <span className="text-2xl font-bold text-primary">
                        ₪{data.hourly_rate_min || 20}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={20}
                        max={data.hourly_rate_max || 200}
                        step={5}
                        value={data.hourly_rate_min || 20}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!data.hourly_rate_max || value <= data.hourly_rate_max) {
                            updateField("hourly_rate_min", value);
                          }
                        }}
                        className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>₪20</span>
                        <span>₪{data.hourly_rate_max || 200}</span>
                      </div>
                    </div>
                  </div>

                  {/* Max Rate Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Maximum Rate</span>
                      <span className="text-2xl font-bold text-primary">
                        ₪{data.hourly_rate_max || 200}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={data.hourly_rate_min || 20}
                        max={200}
                        step={5}
                        value={data.hourly_rate_max || 200}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!data.hourly_rate_min || value >= data.hourly_rate_min) {
                            updateField("hourly_rate_max", value);
                          }
                        }}
                        className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>₪{data.hourly_rate_min || 20}</span>
                        <span>₪200</span>
                      </div>
                    </div>
                  </div>

                  {/* Rate Summary */}
                  <div className="pt-2 pb-1 text-center">
                    <p className="text-sm text-muted-foreground">
                      Range: <span className="font-semibold text-foreground">₪{data.hourly_rate_min || 20}</span> - <span className="font-semibold text-foreground">₪{data.hourly_rate_max || 200}</span> per hour
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="border-0 shadow-lg mt-6">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize your app experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mb-24">
          <Button 
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

