import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  role: "client" | "freelancer" | "admin";
  is_admin?: boolean;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  photo_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingProfileRef = React.useRef<string | null>(null);
  const profileUserIdRef = React.useRef<string | null>(null);

  async function fetchProfile(userId: string, forceRefresh: boolean = false): Promise<void> {
    // Prevent multiple simultaneous fetches for the same user
    if (fetchingProfileRef.current === userId) {
      console.log("[AuthContext] Profile fetch already in progress for user", userId);
      return;
    }
    // If profile for this user is already loaded, skip fetching (unless forced)
    if (!forceRefresh && profileUserIdRef.current === userId && profile !== null) {
      console.log("[AuthContext] Profile already loaded for user", userId);
      return;
    }
    
    // Check if tab is visible - don't fetch if tab is hidden (user switched away)
    if (typeof document !== "undefined" && document.hidden) {
      console.log("[AuthContext] Tab is hidden, deferring profile fetch until tab becomes visible");
      return;
    }
    
    // Try to load from localStorage first as fallback
    const cachedProfileKey = `profile_${userId}`;
    const cachedProfile = localStorage.getItem(cachedProfileKey);
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        // Check if cache is less than 5 minutes old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          console.log("[AuthContext] Using cached profile (age:", Math.round((Date.now() - parsed.timestamp) / 1000), "s)");
          setProfile(parsed.data);
          profileUserIdRef.current = userId;
          // Still try to fetch fresh data in background, but don't block
          fetchingProfileRef.current = userId;
          (async () => {
            try {
              const { data: freshData, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();
              
              if (!error && freshData && fetchingProfileRef.current === userId) {
                console.log("[AuthContext] Background refresh successful");
                setProfile(freshData);
                localStorage.setItem(cachedProfileKey, JSON.stringify({
                  data: freshData,
                  timestamp: Date.now()
                }));
              }
            } catch (err) {
              console.warn("[AuthContext] Background refresh failed:", err);
            } finally {
              fetchingProfileRef.current = null;
            }
          })();
          return; // Return early, don't fetch synchronously
        }
      } catch (e) {
        console.warn("[AuthContext] Failed to parse cached profile", e);
      }
    }
    
    fetchingProfileRef.current = userId;
    console.log("[AuthContext] fetchProfile called", { userId });
    
    const startTime = Date.now();
    try {
      console.log("[AuthContext] Starting profile query...");
      console.log("[AuthContext] Supabase URL:", import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + "...");
      console.log("[AuthContext] User ID:", userId);
      
      // Verify Supabase client is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes("your-project-id") || supabaseUrl.includes("placeholder")) {
        console.error("[AuthContext] Supabase not properly configured!");
        setProfile(null);
        return;
      }
      
      // Verify we have a valid session before querying
      // Add timeout to getSession call as it can hang
      console.log("[AuthContext] Getting session...");
      let currentSession = null;
      let sessionError = null;
      
      try {
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise<{ data: { session: null }; error: { message: string; code: string } }>((resolve) => {
          setTimeout(() => {
            resolve({
              data: { session: null },
              error: { message: "getSession timeout after 3 seconds", code: "TIMEOUT" }
            });
          }, 3000); // Increased to 3 seconds
        });
        
        const sessionResult = await Promise.race([sessionPromise, sessionTimeout]) as any;
        currentSession = sessionResult?.data?.session;
        sessionError = sessionResult?.error;
        
        if (sessionError?.code === "TIMEOUT") {
          console.warn("[AuthContext] ⚠️ getSession timed out - using cached session if available");
          // Try to get session from localStorage directly
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (supabaseUrl) {
              const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
              if (projectRef) {
                const storedSession = localStorage.getItem(`sb-${projectRef}-auth-token`);
                if (storedSession) {
                  const parsed = JSON.parse(storedSession);
                  if (parsed?.currentSession?.user?.id === userId) {
                    currentSession = parsed.currentSession;
                    console.log("[AuthContext] Using cached session from localStorage");
                    sessionError = null; // Clear error since we have cached session
                  }
                }
              }
            }
          } catch (e) {
            console.warn("[AuthContext] Failed to parse cached session", e);
          }
        }
      } catch (err: any) {
        console.error("[AuthContext] Exception getting session:", err);
        sessionError = err;
      }
      
      if (sessionError && !currentSession) {
        console.warn("[AuthContext] Error getting session (but continuing with cached data if available):", sessionError.message || sessionError);
        // Try to use cached profile instead
        const cachedProfileKey = `profile_${userId}`;
        const cachedProfile = localStorage.getItem(cachedProfileKey);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            console.log("[AuthContext] Using cached profile due to session error");
            setProfile(parsed.data);
            profileUserIdRef.current = userId;
            return;
          } catch (e) {
            console.warn("[AuthContext] Failed to parse cached profile", e);
          }
        }
        // Don't set profile to null if we have a cached one - let it stay
        // Only return if we truly have no session and no cache
        if (!cachedProfile) {
          setProfile(null);
          return;
        }
      }
      
      if (!currentSession || !currentSession.user) {
        console.error("[AuthContext] No valid session found, cannot fetch profile");
        // Try cache
        const cachedProfileKey = `profile_${userId}`;
        const cachedProfile = localStorage.getItem(cachedProfileKey);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            console.log("[AuthContext] Using cached profile - no session");
            setProfile(parsed.data);
            profileUserIdRef.current = userId;
            return;
          } catch (e) {
            console.warn("[AuthContext] Failed to parse cached profile", e);
          }
        }
        setProfile(null);
        return;
      }
      
      if (currentSession.user.id !== userId) {
        console.error("[AuthContext] Session user ID doesn't match requested user ID");
        setProfile(null);
        return;
      }
      
      // Verify access token is present
      if (!currentSession.access_token) {
        console.error("[AuthContext] No access token in session");
        setProfile(null);
        return;
      }
      
      console.log("[AuthContext] Session verified:", {
        userId: currentSession.user.id,
        hasAccessToken: !!currentSession.access_token,
        expiresAt: currentSession.expires_at
      });
      
      // Add explicit timeout wrapper to prevent hanging queries
      // Use a shorter timeout (3 seconds) and simpler query first
      let queryAborted = false;
      
      console.log("[AuthContext] Creating query promise...");
      
      // Create timeout promise first (will resolve after 3 seconds)
      const timeoutPromise = new Promise<{ data: null; error: { message: string; code: string } }>((resolve) => {
        setTimeout(() => {
          console.error("[AuthContext] ⚠️ TIMEOUT: Query timeout after 3 seconds - request is hanging");
          console.error("[AuthContext] This usually indicates:");
          console.error("  1. Network connectivity issues");
          console.error("  2. Supabase project is paused or inactive");
          console.error("  3. RLS policies are blocking the query");
          console.error("  4. Database connection issues");
          console.error("[AuthContext] Current session:", {
            hasSession: !!currentSession,
            userId: currentSession?.user?.id,
            expiresAt: currentSession?.expires_at,
            accessToken: currentSession?.access_token ? "present" : "missing",
            tokenExpiry: currentSession?.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : "N/A"
          });
          queryAborted = true;
          resolve({
            data: null,
            error: {
              message: "Profile query timeout after 3 seconds",
              code: "TIMEOUT"
            }
          });
        }, 3000);
      });
      
      const queryPromise = (async () => {
        try {
          console.log("[AuthContext] Executing Supabase query...");
          const result = await supabase
            .from("profiles")
            .select("id, role, full_name, city, phone, photo_url, is_admin")
            .eq("id", userId)
            .maybeSingle();
          
          console.log("[AuthContext] Query returned:", { hasData: !!result.data, hasError: !!result.error, errorCode: result.error?.code });
          
          if (queryAborted) {
            console.log("[AuthContext] Query was aborted, returning abort error");
            return { data: null, error: { message: "Query aborted", code: "ABORTED" } };
          }
          return result;
        } catch (err: any) {
          console.error("[AuthContext] Query threw exception:", err);
          if (queryAborted) {
            return { data: null, error: { message: "Query aborted", code: "ABORTED" } };
          }
          throw err;
        }
      })();
      
      console.log("[AuthContext] Racing query and timeout promises...");
      const result = await Promise.race([queryPromise, timeoutPromise]) as any;
      const { data, error } = result;
      
      const duration = Date.now() - startTime;
      console.log("[AuthContext] Profile query completed in", duration, "ms");
      
      console.log("[AuthContext] fetchProfile result", { 
        hasData: !!data, 
        data, 
        hasError: !!error, 
        errorCode: error?.code,
        errorMessage: error?.message,
        errorDetails: error,
        duration,
        wasAborted: queryAborted
      });
      
      // If query was aborted due to timeout, try to use cache
      if (queryAborted && (error?.code === "TIMEOUT" || error?.code === "ABORTED")) {
        console.warn("[AuthContext] Query was aborted due to timeout, checking cache...");
        const cachedProfileKey = `profile_${userId}`;
        const cachedProfile = localStorage.getItem(cachedProfileKey);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            // Use cache even if old, better than nothing
            console.log("[AuthContext] ✅ Using cached profile due to timeout");
            setProfile(parsed.data);
            profileUserIdRef.current = userId;
            return;
          } catch (e) {
            console.warn("[AuthContext] Failed to parse cached profile", e);
          }
        } else {
          console.warn("[AuthContext] No cached profile available");
        }
      }
      
      if (error) {
        console.error("[AuthContext] Error fetching profile:", error);
        // If it's a timeout, try to use cached profile if available
        if (error.code === "TIMEOUT" || error.code === "ABORTED" || error.message?.includes("timeout")) {
          console.error("[AuthContext] Query timed out - checking cache...");
          const cachedProfileKey = `profile_${userId}`;
          const cachedProfile = localStorage.getItem(cachedProfileKey);
          if (cachedProfile) {
            try {
              const parsed = JSON.parse(cachedProfile);
              // Use cache even if old, better than nothing
              console.log("[AuthContext] ✅ Using stale cached profile due to timeout");
              setProfile(parsed.data);
              profileUserIdRef.current = userId;
              return;
            } catch (e) {
              console.warn("[AuthContext] Failed to parse cached profile", e);
            }
          } else {
            console.warn("[AuthContext] No cached profile available for timeout fallback");
          }
        }
        // If it's a permission error, log it clearly
        if (error.code === "PGRST301" || error.message?.includes("permission") || error.message?.includes("policy")) {
          console.error("[AuthContext] RLS POLICY ERROR - Check your Supabase RLS policies for the profiles table!");
          console.error("[AuthContext] Current auth state:", {
            hasSession: !!currentSession,
            userId: currentSession?.user?.id,
            authUid: currentSession?.user?.id
          });
          // Try to use cached profile even on RLS error
          const cachedProfileKey = `profile_${userId}`;
          const cachedProfile = localStorage.getItem(cachedProfileKey);
          if (cachedProfile) {
            try {
              const parsed = JSON.parse(cachedProfile);
              console.log("[AuthContext] Using cached profile due to RLS error");
              setProfile(parsed.data);
              profileUserIdRef.current = userId;
              return;
            } catch (e) {
              console.warn("[AuthContext] Failed to parse cached profile", e);
            }
          }
        }
        setProfile(null);
        return;
      }
      
      // maybeSingle() returns { data: null, error: null } when no rows found
      if (!data) {
        console.log("[AuthContext] No profile found (new user)");
        setProfile(null);
        return;
      }
      
      console.log("[AuthContext] Setting profile", { profile: data });
      setProfile(data);
      profileUserIdRef.current = userId; // Track which user's profile we have
      
      // Cache profile in localStorage
      try {
        localStorage.setItem(cachedProfileKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("[AuthContext] Failed to cache profile", e);
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error("[AuthContext] Exception in fetchProfile after", duration, "ms", err);
      console.error("[AuthContext] Exception details:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      });
      
      // If it's a timeout, log network issue but don't fail completely
      if (err?.message?.includes("timeout")) {
        console.error("[AuthContext] NETWORK TIMEOUT - The query is hanging. Check:");
        console.error("  1. Browser Network tab - is the request being sent?");
        console.error("  2. Supabase dashboard - is the project active?");
        console.error("  3. RLS policies - are they blocking the query?");
        // Try one more time with a simpler query and verify session
        console.log("[AuthContext] Retrying with simpler query...");
        try {
          // Verify session is still valid
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession || !retrySession.user || retrySession.user.id !== userId) {
            console.error("[AuthContext] Session invalid during retry");
            throw new Error("Invalid session");
          }
          
          const retryTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Retry timeout")), 3000);
          });
          
          // Try with minimal fields first
          const retryQueryPromise = supabase
            .from("profiles")
            .select("id, role")
            .eq("id", userId)
            .maybeSingle();
          
          const { data: retryData, error: retryError } = await Promise.race([
            retryQueryPromise,
            retryTimeoutPromise
          ]);
          
          if (!retryError && retryData) {
            console.log("[AuthContext] Retry successful, got minimal profile data");
            setProfile(retryData as any);
            profileUserIdRef.current = userId;
            // Cache minimal profile
            try {
              localStorage.setItem(cachedProfileKey, JSON.stringify({
                data: retryData,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.warn("[AuthContext] Failed to cache retry profile", e);
            }
            return;
          } else if (retryError) {
            console.error("[AuthContext] Retry query error:", retryError);
          }
        } catch (retryErr) {
          console.error("[AuthContext] Retry also failed:", retryErr);
        }
        // Set profile to null so user can proceed to onboarding
        setProfile(null);
        profileUserIdRef.current = null;
      } else {
        setProfile(null);
        profileUserIdRef.current = null;
      }
    } finally {
      fetchingProfileRef.current = null;
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id, true); // Force refresh when explicitly called
    }
  }

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
      console.error("⚠️ Supabase not configured. Please update apps/web/.env");
      setLoading(false);
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let isTabVisible = true;
    let lastProfileFetchTime = 0;
    let lastAuthEventTime = 0;
    let tabJustBecameVisible = false;
    let tabVisibilityChangeTime = 0;
    const MIN_PROFILE_FETCH_INTERVAL = 30000; // Don't fetch profile more than once per 30 seconds
    const MIN_AUTH_EVENT_INTERVAL = 5000; // Ignore auth events within 5 seconds of each other
    const TAB_VISIBILITY_GRACE_PERIOD = 10000; // Ignore auth events for 10 seconds after tab becomes visible

    // Handle page visibility changes (tab switching)
    const handleVisibilityChange = () => {
      const wasVisible = isTabVisible;
      isTabVisible = !document.hidden;
      
      if (!wasVisible && isTabVisible) {
        // Tab just became visible - set flag to prevent unnecessary refetches
        tabJustBecameVisible = true;
        tabVisibilityChangeTime = Date.now();
        console.log("[AuthContext] Tab became visible, setting grace period");
        
        // Clear the flag after grace period
        setTimeout(() => {
          tabJustBecameVisible = false;
        }, TAB_VISIBILITY_GRACE_PERIOD);
      } else if (wasVisible && !isTabVisible) {
        // Tab became hidden - clear the flag
        tabJustBecameVisible = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Safety timeout - always stop loading after 8 seconds max (matching query timeout)
    // This ensures UI doesn't hang if profile fetch fails
    const setSafetyTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn("[AuthContext] Safety timeout - forcing loading to false after 8 seconds");
          console.warn("[AuthContext] If profile fetch is still pending, user can proceed to onboarding");
          setLoading(false);
          // If profile is still null after timeout, that's okay - user can go to onboarding
        }
      }, 8000);
    };

    setSafetyTimeout();

    async function initializeAuth() {
      console.log("[AuthContext] Initializing, getting session...");
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log("[AuthContext] getSession result", { 
          hasSession: !!session, 
          hasUser: !!session?.user, 
          userId: session?.user?.id,
          hasError: !!error 
        });
        
        if (!mounted) return;
        
        if (error) {
          console.error("[AuthContext] Error getting session:", error);
          if (mounted) {
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
          }
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        try {
          if (session?.user) {
            // Check if we already have a cached profile for this user
            const cachedProfileKey = `profile_${session.user.id}`;
            const cachedProfile = localStorage.getItem(cachedProfileKey);
            if (cachedProfile) {
              try {
                const parsed = JSON.parse(cachedProfile);
                // Check if cache is less than 5 minutes old
                if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                  console.log("[AuthContext] Using cached profile on init (age:", Math.round((Date.now() - parsed.timestamp) / 1000), "s)");
                  setProfile(parsed.data);
                  profileUserIdRef.current = session.user.id;
                  lastProfileFetchTime = Date.now();
                  // Still try to fetch fresh data in background, but don't block
                  fetchProfile(session.user.id).catch(err => {
                    console.warn("[AuthContext] Background profile refresh failed:", err);
                  });
                } else {
                  console.log("[AuthContext] User found, fetching profile...");
                  await fetchProfile(session.user.id);
                }
              } catch (e) {
                console.warn("[AuthContext] Failed to parse cached profile, fetching fresh:", e);
                await fetchProfile(session.user.id);
              }
            } else {
              console.log("[AuthContext] User found, fetching profile...");
              await fetchProfile(session.user.id);
            }
        } else {
          console.log("[AuthContext] No user in session");
          setProfile(null);
          profileUserIdRef.current = null;
        }
        } catch (err) {
          console.error("[AuthContext] Error in initializeAuth:", err);
          setProfile(null);
        } finally {
          if (mounted) {
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
            console.log("[AuthContext] Initialization complete, loading set to false");
          }
        }
      } catch (err) {
        console.error("[AuthContext] Failed to get session:", err);
        if (mounted) {
          if (timeoutId) clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION - already handled by getSession()
        if (event === "INITIAL_SESSION") {
          console.log("[AuthContext] Skipping INITIAL_SESSION event");
          return;
        }

        // Rate limit auth events - ignore if too frequent (prevents spam when switching tabs)
        const timeSinceLastAuthEvent = Date.now() - lastAuthEventTime;
        if (timeSinceLastAuthEvent < MIN_AUTH_EVENT_INTERVAL && event !== "SIGNED_OUT") {
          console.log("[AuthContext] Auth event too frequent, ignoring:", event);
          return;
        }
        
        // If tab just became visible and we have a profile, ignore SIGNED_IN events (they're just from tab visibility)
        if (tabJustBecameVisible && event === "SIGNED_IN" && profile && session?.user && profile.id === session.user.id) {
          const timeSinceTabVisible = Date.now() - tabVisibilityChangeTime;
          if (timeSinceTabVisible < TAB_VISIBILITY_GRACE_PERIOD) {
            console.log("[AuthContext] Tab just became visible, ignoring SIGNED_IN event (likely from visibility change)");
            if (mounted) {
              setSession(session);
              setUser(session.user);
            }
            return;
          }
        }
        
        lastAuthEventTime = Date.now();

        // Skip TOKEN_REFRESHED events if profile is already loaded - these happen frequently
        // and don't require re-fetching the profile
        if (event === "TOKEN_REFRESHED") {
          console.log("[AuthContext] Token refreshed, keeping existing profile");
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
            // Don't set loading or refetch profile for token refresh
          }
          return;
        }
        
        // Skip SIGNED_IN events if we already have the same user and profile
        // This prevents refetching when tab becomes visible again
        if (event === "SIGNED_IN" && session?.user && profile && profile.id === session.user.id && profileUserIdRef.current === session.user.id) {
          const timeSinceLastFetch = Date.now() - lastProfileFetchTime;
          // Only skip if profile was fetched recently (within last 30 seconds)
          if (timeSinceLastFetch < MIN_PROFILE_FETCH_INTERVAL) {
            console.log("[AuthContext] Already signed in with same user and recent profile, skipping refetch");
            if (mounted) {
              setSession(session);
              setUser(session.user);
              // Don't set loading or refetch profile
            }
            return;
          }
        }

        // Don't process auth events if tab is hidden (user switched away)
        if (typeof document !== "undefined" && document.hidden && event !== "SIGNED_OUT") {
          console.log("[AuthContext] Tab is hidden, deferring auth event:", event);
          if (mounted) {
            // Still update session/user but don't fetch profile
            setSession(session);
            setUser(session?.user ?? null);
          }
          return;
        }

        console.log("[AuthContext] Auth state changed", { 
          event, 
          hasSession: !!session, 
          hasUser: !!session?.user,
          userId: session?.user?.id,
          isTabVisible: !document.hidden
        });
        
        if (!mounted) return;
        
        // Check if we recently fetched profile - prevent rapid refetches
        const timeSinceLastFetch = Date.now() - lastProfileFetchTime;
        const shouldSkipFetch = timeSinceLastFetch < MIN_PROFILE_FETCH_INTERVAL && 
                                profile && 
                                session?.user && 
                                profile.id === session.user.id &&
                                profileUserIdRef.current === session.user.id;
        
        // Also skip if tab just became visible (grace period)
        const shouldSkipDueToVisibility = tabJustBecameVisible && 
                                          profile && 
                                          session?.user && 
                                          profile.id === session.user.id &&
                                          (Date.now() - tabVisibilityChangeTime) < TAB_VISIBILITY_GRACE_PERIOD;
        
        if ((shouldSkipFetch || shouldSkipDueToVisibility) && event !== "SIGNED_OUT") {
          console.log("[AuthContext] Skipping refetch - profile recently fetched or tab just became visible. Event:", event);
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
          }
          return;
        }
        
        // Only set loading if we actually need to fetch profile
        const needsProfileFetch = session?.user && (
          !profile || 
          profile.id !== session.user.id || 
          profileUserIdRef.current !== session.user.id
        );
        
        if (needsProfileFetch && !shouldSkipFetch && !shouldSkipDueToVisibility) {
          setLoading(true);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        try {
          if (session?.user) {
            // Only fetch profile if we don't already have it for this user
            // AND if we're not already fetching it
            // AND if tab is visible
            // AND if we're not in the visibility grace period
            if (
              !shouldSkipFetch &&
              !shouldSkipDueToVisibility &&
              (!profile || 
               profile.id !== session.user.id || 
               profileUserIdRef.current !== session.user.id)
            ) {
              // Check if fetch is already in progress
              if (fetchingProfileRef.current !== session.user.id) {
                // Double-check tab is visible and not in grace period before fetching
                if (typeof document !== "undefined" && !document.hidden && !tabJustBecameVisible) {
                  console.log("[AuthContext] User in new session, fetching profile...");
                  lastProfileFetchTime = Date.now();
                  await fetchProfile(session.user.id);
                } else {
                  console.log("[AuthContext] Tab is hidden or in grace period, skipping profile fetch");
                }
              } else {
                console.log("[AuthContext] Profile fetch already in progress, skipping");
              }
            } else {
              console.log("[AuthContext] Profile already loaded for this user, skipping fetch");
            }
          } else {
            console.log("[AuthContext] No user in new session, clearing profile");
            setProfile(null);
            profileUserIdRef.current = null;
          }
        } catch (err) {
          console.error("[AuthContext] Error in onAuthStateChange handler:", err);
          setProfile(null);
          profileUserIdRef.current = null;
        } finally {
          // Only set loading to false if we set it to true
          if (mounted && needsProfileFetch && !shouldSkipFetch && !shouldSkipDueToVisibility) {
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
            console.log("[AuthContext] Auth state change handler complete, loading set to false");
          }
        }
      }
    );

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signUp(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    profileUserIdRef.current = null;
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
