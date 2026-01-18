import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Conversation {
  id: string;
  job_id: string;
  freelancer_id: string;
  created_at: string;
  freelancer_profile?: {
    full_name: string | null;
    photo_url: string | null;
  };
  last_message?: {
    body: string;
    created_at: string;
  };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTest, setCreatingTest] = useState(false);

  useEffect(() => {
    async function loadConversations() {
      if (!user) return;

      try {
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, job_id, freelancer_id, created_at")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (!convos) return;

        // Fetch profiles and last messages
        const enriched = await Promise.all(
          convos.map(async (convo) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, photo_url")
              .eq("id", convo.freelancer_id)
              .single();

            const { data: lastMessage } = await supabase
              .from("messages")
              .select("body, created_at")
              .eq("conversation_id", convo.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...convo,
              freelancer_profile: {
                full_name: profile?.full_name || null,
                photo_url: profile?.photo_url || null,
              },
              last_message: lastMessage || undefined,
            };
          })
        );

        setConversations(enriched);
      } catch (err) {
        console.error("Error loading conversations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, [user]);

  async function createTestConversation() {
    if (!user || creatingTest) {
      console.log("Cannot create test conversation:", { user: !!user, creatingTest });
      return;
    }
    setCreatingTest(true);
    
    try {
      // Verify and refresh session first
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        throw new Error("Please log in first");
      }
      
      // Refresh session to ensure token is valid
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Session refresh error:", refreshError);
      }
      
      const result = await apiPost<{ conversation_id: string }>("/api/dev/test-conversation", {});
      // Reload conversations
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, job_id, freelancer_id, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (convos) {
        const enriched = await Promise.all(
          convos.map(async (convo) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, photo_url")
              .eq("id", convo.freelancer_id)
              .single();

            const { data: lastMessage } = await supabase
              .from("messages")
              .select("body, created_at")
              .eq("conversation_id", convo.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...convo,
              freelancer_profile: {
                full_name: profile?.full_name || null,
                photo_url: profile?.photo_url || null,
              },
              last_message: lastMessage || undefined,
            };
          })
        );
        setConversations(enriched);
      }
      
      // Navigate to the new conversation
      navigate(`/chat/${result.conversation_id}`);
    } catch (error: any) {
      console.error("Error creating test conversation:", error);
      alert(error.message || "Failed to create test conversation");
    } finally {
      setCreatingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <MessageCircle className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
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
            <h1 className="text-2xl font-bold">Messages</h1>
          </div>

          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Messages</h3>
              <p className="text-muted-foreground mb-6">
                Start a job request to begin chatting with nannies.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate("/client/create")}>
                  Find a Nanny
                </Button>
                <Button 
                  variant="outline" 
                  onClick={createTestConversation}
                  disabled={creatingTest}
                >
                  {creatingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Test Conversation...
                    </>
                  ) : (
                    "Create Test Conversation"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>

        <div className="space-y-3">
          {conversations.map((convo) => {
            const initials = convo.freelancer_profile?.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?";

            return (
              <Card
                key={convo.id}
                className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => navigate(`/chat/${convo.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={convo.freelancer_profile?.photo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {convo.freelancer_profile?.full_name || "Nanny"}
                      </p>
                      {convo.last_message && (
                        <p className="text-sm text-muted-foreground truncate">
                          {convo.last_message.body}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

