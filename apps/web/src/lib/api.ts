import { supabase } from "./supabase";

const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") as string;

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("[authHeader] Error getting session:", error);
      throw new Error("Failed to get authentication session. Please log in again.");
    }
    
    const token = data.session?.access_token;
    if (!token) {
      console.warn("[authHeader] No auth token available");
      throw new Error("Not authenticated. Please log in.");
    }
    
    console.log("[authHeader] Token retrieved successfully");
    return { Authorization: `Bearer ${token}` };
  } catch (err: any) {
    console.error("[authHeader] Exception:", err);
    throw err;
  }
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiPost] Making request to:", `${base}${path}`);
    
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error("[apiPost] API error:", errorMessage, "Status:", res.status);
      throw new Error(errorMessage);
    }
    
    return res.json();
  } catch (err: any) {
    // Handle network errors
    if (err.message?.includes("fetch failed") || err.message?.includes("Failed to fetch")) {
      console.error("[apiPost] Network error - Is the backend running?", err);
      throw new Error("Cannot connect to server. Please make sure the backend is running on port 4000.");
    }
    throw err;
  }
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiGet] Making request to:", `${base}${path}`);
    
    const res = await fetch(`${base}${path}`, { headers });
    
    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error("[apiGet] API error:", errorMessage, "Status:", res.status);
      throw new Error(errorMessage);
    }
    
    return res.json();
  } catch (err: any) {
    // Handle network errors
    if (err.message?.includes("fetch failed") || err.message?.includes("Failed to fetch")) {
      console.error("[apiGet] Network error - Is the backend running?", err);
      throw new Error("Cannot connect to server. Please make sure the backend is running on port 4000.");
    }
    throw err;
  }
}

