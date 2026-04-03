import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";

type ProfileEmbed = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
};

type HireInterest = {
  id: string;
  client_id: string;
  status: string;
  created_at: string;
  job_request_id: string | null;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
};

function profileFromRow(row: HireInterest): ProfileEmbed | null {
  const p = row.profiles;
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

export default function CommunityPostHireInterestsPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<HireInterest[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await apiGet<{ interests: HireInterest[] }>(
        `/api/jobs/community-post/${postId}/hire-interests`
      );
      setInterests(res.interests || []);
    } catch (e) {
      addToast({
        title: "Could not load interests",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      setInterests([]);
    } finally {
      setLoading(false);
    }
  }, [postId, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async (interestId: string) => {
    setActingId(interestId);
    try {
      const res = await apiPost<{ job_id: string; conversation_id: string }>(
        `/api/jobs/community-hire-interest/${interestId}/confirm`,
        {}
      );
      addToast({
        title: "Booking confirmed",
        description: "A live job and chat were created for both of you.",
        variant: "success",
      });
      await load();
      navigate(`/chat/${res.conversation_id}`);
    } catch (e) {
      addToast({
        title: "Could not confirm",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (interestId: string) => {
    setActingId(interestId);
    try {
      await apiPost(`/api/jobs/community-hire-interest/${interestId}/decline`, {});
      addToast({ title: "Declined", variant: "default" });
      await load();
    } catch (e) {
      addToast({
        title: "Could not decline",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  if (!user || profile?.role !== "freelancer") {
    return (
      <div className="app-desktop-shell px-4 py-10">
        <p className="text-sm text-muted-foreground">Only helpers can manage hire interest on their posts.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/availability">Back</Link>
        </Button>
      </div>
    );
  }

  const pending = interests.filter((i) => i.status === "pending");

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell max-w-2xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full" asChild>
            <Link to="/availability">
              <ArrowLeft className="h-4 w-4" />
              Availability
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Hire interest
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People who tapped Hire now on this availability post. Confirm to start a live job and chat.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          </div>
        ) : pending.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No pending hire interest for this post.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((row) => {
              const p = profileFromRow(row);
              return (
                <Card key={row.id} className="overflow-hidden border-border/80 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <Avatar className="h-14 w-14 shrink-0 border border-border/60">
                        <AvatarImage src={p?.photo_url ?? undefined} className="object-cover" />
                        <AvatarFallback className="bg-orange-100 text-lg font-bold text-orange-800">
                          {(p?.full_name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-foreground">
                          {p?.full_name || "Client"}
                        </p>
                        {p?.city && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {p.city}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          Interested {new Date(row.created_at).toLocaleString()}
                        </p>
                        <Button variant="link" className="mt-1 h-auto p-0 text-xs font-bold" asChild>
                          <Link to={`/profile/${row.client_id}`}>View profile</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
                      <Button
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 sm:flex-none"
                        disabled={actingId !== null}
                        onClick={() => void handleConfirm(row.id)}
                      >
                        {actingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 sm:flex-none"
                        disabled={actingId !== null}
                        onClick={() => void handleDecline(row.id)}
                      >
                        {actingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {interests.some((i) => i.status !== "pending") && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Earlier
            </p>
            {interests
              .filter((i) => i.status !== "pending")
              .map((row) => {
                const p = profileFromRow(row);
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{p?.full_name || "Client"}</span>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {row.status}
                    </Badge>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
