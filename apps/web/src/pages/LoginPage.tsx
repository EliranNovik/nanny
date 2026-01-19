import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Baby, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in (wait for auth to finish loading)
  useEffect(() => {
    console.log("[LoginPage] useEffect triggered", {
      authLoading,
      hasUser: !!user,
      profile,
    });

    // Only redirect after loading is complete
    if (!authLoading && user) {
      console.log("[LoginPage] Ready to redirect", { profile });
      // Small delay to ensure auth state is fully updated
      const timer = setTimeout(() => {
        if (!profile) {
          console.log("[LoginPage] Redirecting to /onboarding (no profile)");
          navigate("/onboarding", { replace: true });
        } else if (profile.role === "client") {
          console.log("[LoginPage] Redirecting to /dashboard (client)");
          navigate("/dashboard", { replace: true });
        } else {
          console.log("[LoginPage] Redirecting to /freelancer/dashboard");
          navigate("/freelancer/dashboard", { replace: true });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, profile, authLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("[LoginPage] handleSubmit called", { isSignUp, email });

    const { error } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password);

    console.log("[LoginPage] Auth result", { error: error?.message, hasError: !!error });

    if (error) {
      // Check for CORS/network errors
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("CORS") ||
        errorMessage.includes("fetch") ||
        errorMessage.includes("Failed to fetch")
      ) {
        setError(
          "Cannot connect to Supabase. This usually means:\n\n" +
          "1. Your Supabase project is paused (free tier pauses after 7 days)\n" +
          "   → Go to https://supabase.com/dashboard and restore your project\n\n" +
          "2. Network connectivity issues\n" +
          "   → Check your internet connection\n\n" +
          "3. Browser extension blocking requests\n" +
          "   → Try disabling ad blockers or privacy extensions"
        );
      } else {
        setError(errorMessage);
      }
      setLoading(false);
      return;
    }

    console.log("[LoginPage] Auth successful, waiting for profile to load...");
    // Wait a moment for auth state to update, then redirect will happen via useEffect
    // Don't navigate here - let the useEffect handle it based on profile state
    setLoading(false);
  }

  // Show loading if auth is loading
  if (authLoading) {
    console.log("[LoginPage] Showing loading spinner", { authLoading, hasUser: !!user, profile });
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Don't show login page if already logged in (redirect will happen)
  if (user) {
    console.log("[LoginPage] User exists, hiding login form (redirect pending)");
    return null;
  }

  console.log("[LoginPage] Rendering login form");

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg">
            <Baby className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">NannyNow</h1>
          <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            Find childcare in minutes
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>
              {isSignUp 
                ? "Start finding or offering childcare today" 
                : "Sign in to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm whitespace-pre-line">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

