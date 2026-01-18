import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, ArrowLeft, Loader2, Camera, X, Navigation } from "lucide-react";
import { getCityFromLocation } from "@/lib/location";

export default function ClientProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setCity(profile.city || "");
      setPhone(profile.phone || "");
      setPhotoUrl(profile.photo_url || null);
    }
  }, [profile]);

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
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        role: profile?.role || "client", // Preserve existing role or default to client
        full_name: fullName.trim(),
        city: city.trim(),
        phone: phone.trim() || null,
        photo_url: photoUrl,
      });

      if (error) {
        throw error;
      }

      await refreshProfile();
      
      addToast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error saving profile:", error);
      addToast({
        title: "Save failed",
        description: error.message || "Failed to save profile",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Update your information</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
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

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

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
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

