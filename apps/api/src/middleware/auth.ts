import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
  console.error("❌ SUPABASE_URL is not configured. Please update apps/api/.env with your actual Supabase URL");
}

if (!supabaseServiceKey || supabaseServiceKey.includes("your-service-role-key")) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not configured. Please update apps/api/.env with your actual service role key");
}

const supa = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key",
  { auth: { persistSession: false } }
);

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    
    console.log("[AuthMiddleware] Request received", {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      path: req.path,
      method: req.method
    });
    
    if (!token) {
      console.error("[AuthMiddleware] Missing bearer token");
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    // Check if Supabase is configured
    if (!supabaseUrl || supabaseUrl.includes("your-project-id") || 
        !supabaseServiceKey || supabaseServiceKey.includes("your-service-role-key")) {
      console.error("[AuthMiddleware] Supabase not configured properly");
      res.status(500).json({ 
        error: "Server configuration error: Supabase credentials not set. Please update apps/api/.env with your Supabase URL and service role key." 
      });
      return;
    }

    const { data, error } = await supa.auth.getUser(token);
    
    if (error) {
      console.error("[AuthMiddleware] Token validation error:", {
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      // Provide helpful error message for common issues
      let errorMessage = error.message;
      if (error.message?.includes("fetch failed") || error.message?.includes("Failed to fetch")) {
        errorMessage = "Cannot connect to Supabase. Please check your SUPABASE_URL in apps/api/.env";
      }
      
      res.status(401).json({ error: `Invalid token: ${errorMessage}` });
      return;
    }
    
    if (!data?.user) {
      console.error("[AuthMiddleware] No user found in token data");
      res.status(401).json({ error: "Invalid token: No user found" });
      return;
    }

    console.log("[AuthMiddleware] User authenticated:", data.user.id);
    (req as AuthenticatedRequest).user = data.user;
    next();
  } catch (err: any) {
    console.error("[AuthMiddleware] Unexpected error:", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name
    });
    res.status(500).json({ error: `Authentication error: ${err?.message || "Unknown error"}` });
  }
}

