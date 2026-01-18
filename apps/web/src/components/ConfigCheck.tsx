import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigCheck() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const isConfigured = 
    supabaseUrl && 
    !supabaseUrl.includes("your-project-id") &&
    supabaseKey && 
    !supabaseKey.includes("your-anon-key");

  if (isConfigured) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg border-destructive/50 border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-destructive">Configuration Required</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your Supabase credentials are not configured. Please update your environment variables.
          </p>
          
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-semibold">Edit <code className="bg-background px-2 py-1 rounded">apps/web/.env</code>:</p>
            <pre className="bg-background p-3 rounded overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_BASE_URL=http://localhost:4000`}
            </pre>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-semibold">Get your credentials from:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">supabase.com</a></li>
              <li>Open your project</li>
              <li>Go to <strong>Project Settings → API</strong></li>
              <li>Copy <strong>Project URL</strong> → <code>VITE_SUPABASE_URL</code></li>
              <li>Copy <strong>anon public</strong> key → <code>VITE_SUPABASE_ANON_KEY</code></li>
            </ol>
          </div>

          <p className="text-xs text-muted-foreground">
            After updating, restart the dev server (stop with Ctrl+C, then run <code>npm run dev</code> again).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

