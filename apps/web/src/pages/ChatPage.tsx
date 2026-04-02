import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Phone,
  Paperclip,
  Send,
  Loader2,
  Clock,
  File,
  X,
  Image as ImageIcon,
  Check,
  CheckCheck,
  MapPin,
  Baby,
  FileText,
  Star,
  Repeat,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  Home,
  AlignLeft,
  Sparkles,
  UtensilsCrossed,
  Truck,
  Briefcase,
  Hourglass,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { ImageModal } from "@/components/ImageModal";
import { Badge } from "@/components/ui/badge";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { isServiceCategoryId, serviceCategoryLabel } from "@/lib/serviceCategories";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
}

interface Conversation {
  id: string;
  job_id: string | null;
  client_id: string;
  freelancer_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  phone: string | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  share_whatsapp?: boolean;
  share_telegram?: boolean;
  bio?: string | null;
  role?: "client" | "freelancer";
  rating_avg?: number;
  rating_count?: number;
  categories?: string[];
}

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  schedule_confirmed?: boolean;
  offered_hourly_rate?: number | null;
  price_offer_status?: string | null;
  service_type?: string | null;
  service_details?: any | null;
  time_duration?: string | null;
  care_frequency?: string | null;
  community_post_id?: string | null;
  community_post_expires_at?: string | null;
  notes?: string | null;
}

type CommunityPostCardState =
  | { status: "loading"; postId: string }
  | {
      status: "ready";
      postId: string;
      title: string;
      blurb: string;
      coverUrl: string | null;
      expiresAt: string | null;
      categoryLabel: string | null;
    };

interface ReportConversation {
  id: string;
  client: Profile;
  lastMessage?: Message;
  unreadCount: number;
}

interface ChatPageProps {
  conversationId?: string;
  hideBackButton?: boolean;
  otherUserId?: string; // When provided, fetch messages from all conversations with this user
}

export default function ChatPage({ conversationId: propConversationId, hideBackButton = false, otherUserId: propOtherUserId }: ChatPageProps = {}) {
  const { conversationId: paramConversationId } = useParams<{ conversationId?: string }>();
  const conversationId = propConversationId || paramConversationId;
  const { user, profile: currentUserProfile } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<"steps" | "chat">("steps"); // Default to steps on mobile

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<Message | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  // Job details state
  const [job, setJob] = useState<Job | null>(null);
  const [communityPostCard, setCommunityPostCard] = useState<CommunityPostCardState | null>(null);
  const [priceOffer, setPriceOffer] = useState<number | null>(null);

  // Revise schedule state
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseDate, setReviseDate] = useState<Date | null>(null);
  const [reviseTime, setReviseTime] = useState("");
  const [revisePending, setRevisePending] = useState(false);
  const [freelancerUnavailableTimeSlots, setFreelancerUnavailableTimeSlots] = useState<string[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<Job[]>([]);

  // Revise Price state
  const [showRevisePriceModal, setShowRevisePriceModal] = useState(false);
  const [priceOfferInput, setPriceOfferInput] = useState("");
  const [priceOfferPending, setPriceOfferPending] = useState(false);

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHoursInput, setPaymentHoursInput] = useState("");
  const [paymentHourlyRateInput, setPaymentHourlyRateInput] = useState("");
  const [paymentHourlyRate, setPaymentHourlyRate] = useState(0);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentPending, setPaymentPending] = useState(false);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("");
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [reportConversations, setReportConversations] = useState<ReportConversation[]>([]);

  useEffect(() => {
    // Reset initial load flag when conversation changes
    isInitialLoadRef.current = true;

    async function fetchConversation() {
      if (!conversationId || !user) return;

      // Get conversation details
      const { data: convo } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (!convo) {
        navigate("/");
        return;
      }

      setConversation(convo);

      // Get other user's profile
      const otherId = propOtherUserId || (convo.client_id === user.id ? convo.freelancer_id : convo.client_id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, city, phone, role, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram, categories")
        .eq("id", otherId)
        .single();

      let finalProfile: Profile | null = profile as any;
      if (profile && profile.role === "freelancer") {
        const { data: freelancerData } = await supabase
          .from("freelancer_profiles")
          .select("bio, rating_avg, rating_count")
          .eq("user_id", otherId)
          .single();
        if (freelancerData) {
          finalProfile = {
            ...profile,
            bio: freelancerData.bio,
            rating_avg: freelancerData.rating_avg,
            rating_count: freelancerData.rating_count
          } as Profile;
        }
      }

      setOtherUser(finalProfile);


      // Get job details (only if job_id is not null)
      let jobData = null;
      if (convo.job_id) {
        const { data } = await supabase
          .from("job_requests")
          .select(
            "id, status, stage, care_type, children_count, children_age_group, location_city, start_at, created_at, offered_hourly_rate, price_offer_status, schedule_confirmed, service_type, service_details, time_duration, care_frequency, community_post_id, community_post_expires_at, notes"
          )
          .eq("id", convo.job_id)
          .single();

        jobData = data;
        setJob(jobData);

        // If other user is freelancer, fetch their unavailable dates and scheduled jobs for the calendar
        if (profile?.role === "freelancer") {
          const { data: unavailableDates } = await supabase
            .from("freelancer_unavailable_dates")
            .select("unavailable_date, start_time, end_time")
            .eq("freelancer_id", otherId);
          if (unavailableDates) {
            // For calendar UI: disable days that have any unavailable slots
            const days = Array.from(
              new Set(
                unavailableDates
                  .map((d: any) => d.unavailable_date as string | null)
                  .filter(Boolean)
              )
            ) as string[];
            setFreelancerUnavailableTimeSlots(days);
          }

          const { data: jobs } = await supabase
            .from("job_requests")
            .select("*")
            .eq("selected_freelancer_id", otherId)
            .eq("status", "locked");
          if (jobs) {
            setScheduledJobs(jobs);
          }
        }
      } else {
        setJob(null);
      }


      // If admin viewing reports, fetch all report conversations
      if (currentUserProfile?.is_admin && convo.job_id === null) {
        await fetchReportConversations();
      }

      fetchCurrencies();

      // Get messages - if otherUserId is provided, fetch from ALL conversations with this user
      let msgs;
      if (propOtherUserId) {
        // Find all conversations with this user
        const { data: allConversations } = await supabase
          .from("conversations")
          .select("id")
          .or(`and(client_id.eq.${user.id},freelancer_id.eq.${propOtherUserId}),and(client_id.eq.${propOtherUserId},freelancer_id.eq.${user.id})`);

        if (allConversations && allConversations.length > 0) {
          const conversationIds = allConversations.map(c => c.id);
          const { data: allMsgs } = await supabase
            .from("messages")
            .select("*")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: true });

          msgs = allMsgs;
        }
      } else {
        // Original behavior: fetch messages from single conversation
        const { data: singleMsgs } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        msgs = singleMsgs;
      }

      setMessages(msgs || []);

      // Reset initial load flag when conversation changes
      isInitialLoadRef.current = true;


      setLoading(false);

      // Mark unread messages as read
      if (msgs && msgs.length > 0) {
        const unreadMessages = msgs.filter(
          (msg) => msg.sender_id !== user.id && !msg.read_at
        );
        if (unreadMessages.length > 0) {
          markMessagesAsRead(unreadMessages.map((m) => m.id));
        }
      }
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchConversation();

      // Subscribe to new messages - if otherUserId is provided, subscribe to all conversations with that user
      let allConversations: { id: string }[] | null = null;

      if (propOtherUserId && user) {
        // Find all conversation IDs with this user
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id")
          .or(`and(client_id.eq.${user.id},freelancer_id.eq.${propOtherUserId}),and(client_id.eq.${propOtherUserId},freelancer_id.eq.${user.id})`);

        allConversations = conversations || [];
      }

      if (propOtherUserId && allConversations && allConversations.length > 0 && user) {
        const conversationIds = allConversations.map(c => c.id);
        // Subscribe to all conversations
        channel = supabase
          .channel(`messages:${propOtherUserId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=in.(${conversationIds.join(",")})`,
            },
            async (payload) => {
              const newMsg = payload.new as Message;
              setMessages((prev) => {
                const exists = prev.some((msg) => msg.id === newMsg.id);
                if (exists) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.sender_id !== user?.id) {
                markMessagesAsRead([newMsg.id]);
              }

              // Check if this is a schedule confirmation message - update job stage if needed
              if (newMsg.body?.includes("Schedule confirmed") ||
                newMsg.body?.includes("✓ Schedule confirmed")) {
                const otherId = conversation?.client_id === user?.id
                  ? conversation?.freelancer_id
                  : conversation?.client_id;
                if (newMsg.sender_id === otherId && currentUserProfile?.role === "client") {
                  if (job) {
                    supabase
                      .from("job_requests")
                      .update({ schedule_confirmed: true, stage: "Schedule" })
                      .eq("id", job.id)
                      .then(({ error }) => {
                        if (error) console.error("Error updating schedule_confirmed:", error);
                      });
                  }
                }
              }

              // Check if this is a price offer message - update local price offer
              if (newMsg.body?.includes("💰 Price Offer")) {
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                }
              }

              // Check if payment request was sent - update payment total
              if (newMsg.body?.includes("💰 Payment Request")) {
                if (currentUserProfile?.role === "client" && job) {
                  const { data: paymentData } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("job_id", job.id)
                    .eq("status", "pending")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (paymentData) {
                    setPaymentHourlyRate(paymentData.hourly_rate);
                    setPaymentTotal(paymentData.total_amount);
                  }
                }
              }

              // Check if payment was accepted or completed
              if (newMsg.body?.includes("Payment accepted") ||
                newMsg.body?.includes("✓ Payment accepted") ||
                newMsg.body?.includes("Payment completed") ||
                newMsg.body?.includes("✓ Payment completed")) {
                if (job) {
                  const { data: paymentData } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("job_id", job.id)
                    .in("status", ["accepted", "paid"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (paymentData) {
                    setPaymentTotal(paymentData.total_amount);
                  }
                }
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
              filter: `conversation_id=in.(${conversationIds.join(",")})`,
            },
            (payload) => {
              const updatedMsg = payload.new as Message;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
              );
            }
          )
          .subscribe();
      } else {
        // Fallback to single conversation subscription
        channel = supabase
          .channel(`messages:${conversationId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload) => {
              const newMsg = payload.new as Message;
              setMessages((prev) => {
                const exists = prev.some((msg) => msg.id === newMsg.id);
                if (exists) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.sender_id !== user?.id) {
                markMessagesAsRead([newMsg.id]);
              }

              // Check if this is a schedule confirmation message
              if (newMsg.body?.includes("Schedule confirmed") ||
                newMsg.body?.includes("✓ Schedule confirmed")) {
                if (currentUserProfile?.role === "client" && job) {
                  supabase
                    .from("job_requests")
                    .update({ schedule_confirmed: true, stage: "Schedule" })
                    .eq("id", job.id)
                    .then(({ error }) => {
                      if (error) console.error("Error updating schedule_confirmed:", error);
                    });
                }
              }

              // Check if this is a price offer message
              if (newMsg.body?.includes("💰 Price Offer")) {
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                }
              }

              // Check if payment request was sent
              if (newMsg.body?.includes("💰 Payment Request")) {
                if (currentUserProfile?.role === "client" && job) {
                  const { data: paymentData } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("job_id", job.id)
                    .eq("status", "pending")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (paymentData) {
                    setPaymentHourlyRate(paymentData.hourly_rate);
                    setPaymentTotal(paymentData.total_amount);
                  }
                }
              }

              // Check if payment was accepted or completed
              if (newMsg.body?.includes("Payment accepted") ||
                newMsg.body?.includes("✓ Payment accepted") ||
                newMsg.body?.includes("Payment completed") ||
                newMsg.body?.includes("✓ Payment completed")) {
                if (job) {
                  const { data: paymentData } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("job_id", job.id)
                    .in("status", ["accepted", "paid"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (paymentData) {
                    setPaymentTotal(paymentData.total_amount);
                  }
                }
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const updatedMsg = payload.new as Message;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "payments",
            },
            async (payload) => {
              // Check if this payment is for the current job
              const paymentJobId = payload.new.job_id;
              if (job && paymentJobId === job.id) {
                const paymentData = payload.new;
                setPaymentHourlyRate(paymentData.hourly_rate);
                setPaymentTotal(paymentData.total_amount);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "payments",
            },
            async (payload) => {
              // Check if this payment is for the current job
              const paymentJobId = payload.new.job_id;
              if (job && paymentJobId === job.id) {
                const paymentData = payload.new;
                setPaymentHourlyRate(paymentData.hourly_rate);
                setPaymentTotal(paymentData.total_amount);

                // If payment is marked as paid, update job stage to Completed
                if (paymentData.status === "paid") {
                  if (job.stage !== "Completed") {
                    const { error: jobError } = await supabase
                      .from("job_requests")
                      .update({ stage: "Completed" })
                      .eq("id", job.id);

                    if (!jobError) {
                      setJob({ ...job, stage: "Completed" });
                    }
                  }
                }
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "job_requests",
              filter: job ? `id=eq.${job.id}` : undefined,
            },
            async (payload) => {
              // When job stage changes to Payment or Completed, fetch the payment
              if (job && payload.new.id === job.id && (payload.new.stage === "Payment" || payload.new.stage === "Completed")) {
                // Update job state
                setJob({ ...job, stage: payload.new.stage as string });

                // Fetch payment if it exists
                const { data: existingPayment } = await supabase
                  .from("payments")
                  .select("*")
                  .eq("job_id", job.id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (existingPayment) {
                  setPaymentHourlyRate(existingPayment.hourly_rate);
                  setPaymentTotal(existingPayment.total_amount);
                }
              }
            }
          )
          .subscribe();
      }
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId, user, navigate, propOtherUserId, currentUserProfile, job]);

  async function fetchCurrencies() {
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .order("name");
    if (error) {
      console.error("Error fetching currencies:", error);
    } else if (data) {
      setCurrencies(data);
      // Auto-select first currency if none selected
      if (data.length > 0 && !selectedCurrencyId) {
        setSelectedCurrencyId(data[0].id);
      }
    }
  }

  async function fetchReportConversations() {
    if (!user || !currentUserProfile?.is_admin) return;

    try {
      // Fetch all admin report conversations where current user is the admin (freelancer_id)
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select(`
          id,
          client_id,
          created_at
        `)
        .eq("freelancer_id", user.id)
        .is("job_id", null)
        .order("created_at", { ascending: false });

      if (convError) {
        console.error("Error fetching report conversations:", convError);
        return;
      }

      // Fetch client profiles and last messages
      const reportsWithDetails = await Promise.all(
        (conversations || []).map(async (conv) => {
          // Get client profile
          const { data: clientProfile } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url, city, phone, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram")
            .eq("id", conv.client_id)
            .single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("id, conversation_id, sender_id, body, created_at, read_at, read_by")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Count unread messages
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .is("read_at", null)
            .neq("sender_id", user.id);

          // Only include conversations with valid client profiles
          if (!clientProfile) {
            return null;
          }

          return {
            id: conv.id,
            client: clientProfile,
            lastMessage: lastMsg || undefined,
            unreadCount: count || 0,
          };
        })
      );

      // Filter out null values (conversations without client profiles)
      const validReports = reportsWithDetails.filter((r): r is NonNullable<typeof r> => r !== null);
      setReportConversations(validReports);
    } catch (error) {
      console.error("Error fetching report conversations:", error);
    }
  }

  async function markMessagesAsRead(messageIds: string[]) {
    if (!user || markingRead || messageIds.length === 0) return;
    setMarkingRead(true);

    try {
      console.log("[ChatPage] Marking messages as read:", messageIds);
      const results = await Promise.all(
        messageIds.map((msgId) =>
          supabase
            .from("messages")
            .update({ read_at: new Date().toISOString(), read_by: user.id })
            .eq("id", msgId)
            .is("read_at", null)
            .select()
        )
      );

      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error("[ChatPage] Error marking messages as read:", errors);
        console.error("[ChatPage] RLS policy may be missing. Run migration: 010_add_messages_update_policy.sql");
        // Try to update local state anyway if RLS is blocking
        setMessages((prev) =>
          prev.map((msg) => {
            if (messageIds.includes(msg.id) && msg.sender_id !== user.id && !msg.read_at) {
              return {
                ...msg,
                read_at: new Date().toISOString(),
                read_by: user.id,
              };
            }
            return msg;
          })
        );
      } else {
        console.log("[ChatPage] Successfully marked messages as read");
        // Update local state with the returned data
        results.forEach((result) => {
          if (result.data && result.data[0]) {
            const updatedMsg = result.data[0];
            setMessages((prev) =>
              prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
            );
          }
        });
      }
    } catch (error) {
      console.error("[ChatPage] Error marking messages as read:", error);
    } finally {
      setMarkingRead(false);
    }
  }

  // Smooth scroll function
  const scrollToBottom = (smooth = true) => {
    // Try mobile scroll ref first (native div)
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({
        top: mobileScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      return;
    }

    // Desktop: ScrollArea from Radix UI
    if (scrollRef.current) {
      // ScrollArea from Radix UI wraps content, need to find the viewport element
      // The viewport is the first child div inside the ScrollArea
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else {
        // Fallback: try to find viewport by class or direct access
        const viewportElement = scrollRef.current.querySelector('.h-full.w-full') as HTMLElement;
        if (viewportElement) {
          viewportElement.scrollTo({
            top: viewportElement.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
          });
        }
      }
    }
  };

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  // Auto-scroll to bottom on new messages (smooth for new messages, instant for initial load)
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        scrollToBottom(!isInitialLoadRef.current);
      }, 100);
    }
  }, [messages]);

  // Auto-scroll when entering chat view (especially on mobile) - instant
  useEffect(() => {
    if (mobileView === "chat" && messages.length > 0 && !loading) {
      // Small delay to ensure chat area is rendered, but instant scroll
      setTimeout(() => {
        scrollToBottom(false);
      }, 50);
    }
  }, [mobileView, loading]);

  // Auto-scroll when conversation is first loaded - instant
  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoadRef.current) {
      // Instant scroll on initial load
      const timer = setTimeout(() => {
        scrollToBottom(false);
        isInitialLoadRef.current = false;
        
        // Secondary check forced - some scrolling systems need extra cycles
        setTimeout(() => scrollToBottom(false), 150);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, messages]); // Trigger when loading or messages first arrive

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) => msg.sender_id !== user.id && !msg.read_at
      );
      if (unreadMessages.length > 0) {
        markMessagesAsRead(unreadMessages.map((m) => m.id));
      }
    }
  }, [messages, user]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeSelectedFile() {
    setSelectedFile(null);
  }

  function getFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return "image";
    }
    if (["mp4", "webm", "mov", "avi"].includes(ext)) {
      return "video";
    }
    return "file";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !conversationId || !user || sending || uploading) return;

    setSending(true);
    const body = newMessage.trim() || null;
    const tempId = `temp-${Date.now()}`;

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;
    let attachmentSize: number | null = null;

    // Upload file if selected
    if (selectedFile) {
      setUploading(true);
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${conversationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(fileName, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // Check if bucket doesn't exist
          if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
            alert("Storage bucket 'chat-attachments' not found. Please create it in Supabase Dashboard > Storage.");
            console.error("Bucket not found. Please create 'chat-attachments' bucket in Supabase Dashboard.");
          } else {
            console.error("Upload error:", uploadError);
            alert(`Failed to upload file: ${uploadError.message}`);
          }
          throw uploadError;
        }

        // Get public URL for the uploaded file
        if (!uploadData) {
          throw new Error("Upload failed - no data returned");
        }
        const { data: urlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(uploadData.path);

        attachmentUrl = urlData.publicUrl;
        attachmentType = getFileType(selectedFile.name);
        attachmentName = selectedFile.name;
        attachmentSize = selectedFile.size;
      } catch (error: any) {
        console.error("Error uploading file:", error);
        if (!error.message?.includes("Bucket not found")) {
          alert(`Failed to upload file: ${error.message || "Unknown error"}`);
        }
        setUploading(false);
        setSending(false);
        return;
      }
      setUploading(false);
    }

    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
      read_by: null,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setSelectedFile(null);

    // Scroll to bottom smoothly after sending
    setTimeout(() => {
      scrollToBottom(true);
      isInitialLoadRef.current = false; // Mark as no longer initial load
    }, 100);

    const { data, error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
    }).select().single();

    if (error) {
      // Remove optimistic message and restore input
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(body || "");
      setSelectedFile(selectedFile);
      console.error("Error sending message:", error);
    } else if (data) {
      // Replace optimistic message with real one
      setMessages((prev) => prev.map((msg) => msg.id === tempId ? data : msg));
    }

    setSending(false);
    inputRef.current?.focus();
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  }

  function shouldShowDateHeader(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at).toDateString();
    const prev = new Date(messages[index - 1].created_at).toDateString();
    return current !== prev;
  }

  function getReadReceiptStatus(msg: Message): "sent" | "delivered" | "read" {
    if (!msg.read_at) return "sent";
    if (msg.read_by) return "read";
    return "delivered";
  }

  function formatAgeGroup(group: string): string {
    const map: Record<string, string> = {
      newborn: "0-3 months",
      infant: "3-12 months",
      toddler: "1-3 years",
      preschool: "3-5 years",
      mixed: "Mixed ages",
    };
    return map[group] || group;
  }

  function formatServiceDetails(details: any, serviceType?: string) {
    if (!details) return null;
    if (typeof details === 'string') return <div className="col-span-2 flex items-start gap-2 text-foreground font-medium"><AlignLeft className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> {details}</div>;

    const formatValue = (val: any) => {
      if (typeof val !== 'string') return String(val);
      // Replace underscore between digits with a hyphen, rest of underscores with spaces
      let formatted = val.replace(/(\d)_(\d)/g, '$1-$2').replace(/_/g, ' ');
      // For special keys, 'plus' -> '+' 
      if (formatted.includes('plus')) {
        formatted = formatted.replace('plus', '+');
      }
      return formatted;
    };

    if (serviceType === 'pickup_delivery') {
      return (
        <>
          {details.from_address && <div className="flex items-start gap-2"><ArrowUpCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.from_address} (From)</span></div>}
          {details.to_address && <div className="flex items-start gap-2"><ArrowDownCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.to_address} (To)</span></div>}
          {details.weight && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.weight)} kg</span></div>}
        </>
      );
    }

    if (serviceType === 'cleaning') {
      return (
        <>
          {details.home_size && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.home_size)} size</span></div>}
        </>
      )
    }

    // fallback for generic JSON object
    return (
      <>
        {Object.entries(details).map(([key, value]) => {
          if (key === 'custom') return null; // handled separately inside the main return
          // hide raw coordinates if they exist
          if (key === 'from_lat' || key === 'from_lng' || key === 'to_lat' || key === 'to_lng') return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="font-medium text-foreground capitalize text-sm">{formatValue(value)} {key.replace(/_/g, ' ')}</span>
            </div>
          );
        })}
      </>
    );
  }

  function formatDateTimeSimple(dateStr: string | null): string {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }


  function formatJobTitle(job: Job): string {
    if (job.service_type === 'cleaning') return 'Cleaning';
    if (job.service_type === 'cooking') return 'Cooking';
    if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
    if (job.service_type === 'nanny') return 'Nanny';
    if (job.service_type === 'other_help') return 'Other Help';

    return `Nanny – ${Number(job.children_count) || 0} kid${Number(job.children_count) !== 1 ? "s" : ""} (${job.children_age_group && job.children_age_group !== 'null' ? formatAgeGroup(job.children_age_group) : 'N/A'})`;
  }

  // Primitives only — `job` identity changes on every realtime `setJob({ ...job })` (stage, etc.),
  // which was re-running this effect and toggling loading → endless flicker.
  const jobId = job?.id;
  const communityPostId = job?.community_post_id;
  const communityPostExpiresAt = job?.community_post_expires_at;
  const jobNotes = job?.notes;
  const jobServiceType = job?.service_type;
  const jobLocationCity = job?.location_city;

  useEffect(() => {
    if (!communityPostId || !jobId || !job) {
      setCommunityPostCard(null);
      return;
    }
    const postId = communityPostId;
    const j = job;
    setCommunityPostCard({ status: "loading", postId });
    let cancelled = false;
    void (async () => {
      const [{ data: post }, { data: imgRows }] = await Promise.all([
        supabase
          .from("community_posts")
          .select("title, note, body, expires_at, category")
          .eq("id", postId)
          .maybeSingle(),
        supabase
          .from("community_post_images")
          .select("image_url")
          .eq("post_id", postId)
          .order("sort_order", { ascending: true })
          .limit(1),
      ]);
      if (cancelled) return;
      const coverUrl = imgRows?.[0]?.image_url ?? null;
      const expiresAt = post?.expires_at ?? j.community_post_expires_at ?? null;
      const categoryLabel =
        post?.category && isServiceCategoryId(post.category)
          ? serviceCategoryLabel(post.category)
          : j.service_type && isServiceCategoryId(j.service_type)
            ? serviceCategoryLabel(j.service_type)
            : null;

      if (!post) {
        const notes = typeof j.notes === "string" ? j.notes.trim() : "";
        setCommunityPostCard({
          status: "ready",
          postId,
          title: formatJobTitle(j),
          blurb: notes || j.location_city || "Availability post",
          coverUrl: null,
          expiresAt: j.community_post_expires_at ?? null,
          categoryLabel,
        });
        return;
      }

      const blurb =
        (post.note && post.note.trim()) ||
        (post.body && post.body.trim()) ||
        "";
      setCommunityPostCard({
        status: "ready",
        postId,
        title: post.title || formatJobTitle(j),
        blurb,
        coverUrl,
        expiresAt,
        categoryLabel,
      });
    })();
    return () => {
      cancelled = true;
    };
    // Do not depend on `job` — new object references from realtime/partial updates cause infinite loading flashes.
  }, [
    jobId,
    communityPostId,
    communityPostExpiresAt,
    jobNotes,
    jobServiceType,
    jobLocationCity,
  ]);

  function ReadReceipt({ status }: { status: "sent" | "delivered" | "read" }) {
    if (status === "sent") {
      return <Check className="w-4 h-4 text-muted-foreground/60" />;
    }
    if (status === "delivered") {
      return <CheckCheck className="w-4 h-4 text-muted-foreground/60" />;
    }
    return <CheckCheck className="w-4 h-4 text-blue-500" />;
  }

  // For admin viewing reports: show client initials, otherwise show "S" for Support or user initials
  const otherInitials = conversation?.job_id === null
    ? (currentUserProfile?.is_admin
      ? (otherUser?.full_name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "?")
      : "S")
    : (otherUser?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?");

  // Helper functions for social messaging links
  const getWhatsAppLink = (number: string) => {
    const cleaned = number.replace(/[^\d]/g, ''); // Remove + and any non-digits
    return `https://wa.me/${cleaned}`;
  };

  const getTelegramLink = (username: string) => {
    return `https://t.me/${username}`;
  };

  const goToOtherPublicProfile = () => {
    if (otherUser?.id) {
      navigate(`/profile/${otherUser.id}`);
    }
  };

  // Check if social messaging buttons should be shown
  const showWhatsApp = otherUser?.share_whatsapp && otherUser?.whatsapp_number_e164;
  const showTelegram = otherUser?.share_telegram && otherUser?.telegram_username;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn(
      "flex bg-background overflow-hidden",
      hideBackButton ? "relative h-full w-full" : "fixed inset-0"
    )}>
      {/* Side Panel - Step-by-Step Process (only show if not embedded) */}
      {!hideBackButton && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 w-full lg:w-[400px] bg-card/10 backdrop-blur-xl border-r border-border/20 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
            // On mobile: show when mobileView is 'steps', on desktop: always show
            mobileView === "steps" || showContactPanel ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="h-screen lg:h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-card/80 dark:bg-white/5 backdrop-blur-md border-b border-border/20 flex-shrink-0 rounded-t-2xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      // Navigate to active jobs page based on user role
                      if (currentUserProfile?.role === "client") {
                        navigate("/client/active-jobs");
                      } else if (currentUserProfile?.role === "freelancer") {
                        navigate("/freelancer/active-jobs");
                      } else {
                        navigate("/messages");
                      }
                    }}
                    className="text-black dark:text-white"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h2 className="text-lg font-semibold text-black dark:text-white">
                    {conversation?.job_id === null && currentUserProfile?.is_admin ? "Issue Reports" : ""}
                  </h2>
                </div>

                {/* Contact Info - Right side (mobile only) */}
                {conversation?.job_id !== null && otherUser && (
                  <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={goToOtherPublicProfile}
                      disabled={!otherUser.id}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
                      aria-label={otherUser.id ? `View ${otherUser.full_name || "user"} public profile` : undefined}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={otherUser.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {otherInitials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                    <span className="text-sm font-medium leading-tight max-w-[100px] line-clamp-2">
                      {otherUser.full_name || "User"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Phone call functionality
                        console.log("Call", otherUser?.full_name);
                      }}
                    >
                      <Phone className="w-5 h-5" />
                    </Button>
                    {showWhatsApp && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (otherUser?.whatsapp_number_e164) {
                            window.open(getWhatsAppLink(otherUser.whatsapp_number_e164), '_blank');
                          }
                        }}
                        title="Open WhatsApp"
                      >
                        <WhatsAppIcon className="w-5 h-5 fill-[#25D366]" />
                      </Button>
                    )}
                    {showTelegram && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (otherUser?.telegram_username) {
                            window.open(getTelegramLink(otherUser.telegram_username), '_blank');
                          }
                        }}
                        title="Open Telegram"
                      >
                        <TelegramIcon className="w-5 h-5 fill-[#0088cc]" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 pb-56 lg:pb-6 min-h-0" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
              {conversation?.job_id === null && currentUserProfile?.is_admin ? (
                /* Report Conversations List */
                <div className="space-y-2">
                  {reportConversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No issue reports yet
                    </p>
                  ) : (
                    reportConversations.map((report) => {
                      const clientInitials = report.client?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "?";

                      return (
                        <div
                          key={report.id}
                          onClick={() => {
                            navigate(`/chat/${report.id}`);
                            setShowContactPanel(false);
                          }}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer transition-colors border",
                            conversationId === report.id
                              ? "bg-primary/10 border-primary"
                              : "bg-card hover:bg-muted border-border"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={report.client?.photo_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {clientInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">
                                  {report.client?.full_name || "Unknown User"}
                                </p>
                                {report.unreadCount > 0 && (
                                  <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                                    {report.unreadCount > 9 ? "9+" : report.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              {report.lastMessage && (
                                <p className="text-sm text-muted-foreground truncate mt-1">
                                  {report.lastMessage.body}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Job Steps Content - Simplified for mobile as per user request */
                <div className="space-y-8 flex flex-col py-4">
                  {/* Profile Card — full-width hero image on top of box */}
                  <div className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-md dark:border-white/10">
                    <div className="relative w-full min-h-[260px] h-[44vh] max-h-[520px] bg-muted sm:min-h-[300px] sm:h-[40vh] sm:max-h-[560px]">
                      {otherUser?.photo_url ? (
                        <img
                          src={otherUser.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[260px] w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5 sm:min-h-[300px]">
                          <span className="text-5xl font-bold text-primary sm:text-6xl">{otherInitials}</span>
                        </div>
                      )}
                      {/* Readability overlays — badge sits on darker top band */}
                      <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-black/25 to-transparent sm:h-36"
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
                        <div className="rounded-xl border border-white/30 bg-black/65 px-3 py-2 text-center shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-md">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-white sm:text-[11px]">
                            Matched!
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 px-4 pb-4 pt-5 text-center">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold italic text-black dark:text-white">{otherUser?.full_name || "User"}</h3>

                      {otherUser?.role === "freelancer" && (typeof otherUser.rating_avg === 'number') && (
                        <div className="flex items-center justify-center gap-1 text-sm font-medium">
                          <div className="flex items-center text-slate-900 dark:text-white">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-3.5 h-3.5",
                                  i < Math.round(otherUser.rating_avg || 0)
                                    ? "fill-slate-900 text-slate-900 dark:fill-white dark:text-white"
                                    : "fill-none text-slate-300 dark:text-slate-600"
                                )}
                              />
                            ))}
                          </div>
                          <span className="ml-1 text-muted-foreground">
                            ({otherUser.rating_count || 0})
                          </span>
                        </div>
                      )}

                      {/* Social Buttons within the box - Orange with white icons */}
                      {(showWhatsApp || showTelegram) && (
                        <div className="flex justify-center items-center gap-3 pt-4">
                          {showWhatsApp && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-full border-none bg-[#25D366] hover:bg-[#22c35e] hover:scale-105 transition-all shadow-md group"
                              onClick={() => {
                                if (otherUser?.whatsapp_number_e164) {
                                  window.open(getWhatsAppLink(otherUser.whatsapp_number_e164), '_blank');
                                }
                              }}
                            >
                              <WhatsAppIcon className="h-5 w-5 fill-white text-white group-hover:scale-105 transition-transform" />
                            </Button>
                          )}
                          {showTelegram && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-full border-none bg-[#0088cc] hover:bg-[#007bbf] hover:scale-105 transition-all shadow-md group"
                              onClick={() => {
                                if (otherUser?.telegram_username) {
                                  window.open(getTelegramLink(otherUser.telegram_username), '_blank');
                                }
                              }}
                            >
                              <TelegramIcon className="h-[18px] w-[18px] fill-white text-white group-hover:scale-105 transition-transform" />
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Categories Section */}
                      {otherUser?.categories && otherUser.categories.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 pt-4 px-2">
                          {otherUser.categories.map((category, idx) => (
                            <div
                              key={idx}
                              className="bg-primary/5 border border-primary/20 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm"
                            >
                              <span className="text-[10px] font-bold text-primary uppercase tracking-tight">
                                {category}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bio Section Restored */}
                    {otherUser?.bio && (
                      <div className="space-y-2 border-t border-dashed border-primary/10 px-2 pt-4 mt-1 w-full">
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                          "{otherUser.bio}"
                        </p>
                      </div>
                    )}
                    </div>
                  </div>


                  {/* Job Details Section - Modernized Grid */}
                  {job && (
                    <div className="space-y-4 px-2 pt-4 border-t border-dashed">
                      <div className="flex items-center gap-2 font-bold text-base">
                        <Badge variant="outline" className="bg-slate-100 dark:bg-background/30 backdrop-blur-xl text-slate-900 dark:text-white border-slate-200 dark:border-white/20 px-3 py-1.5 shadow-sm font-bold tracking-tight">
                          <FileText className="w-4 h-4 mr-2" />
                          JOB DETAILS
                        </Badge>
                      </div>

                      <div className="bg-card/60 dark:bg-white/10 backdrop-blur-md rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-white/10 shadow-sm">
                        {job.community_post_id ? (
                          !communityPostCard ||
                          communityPostCard.postId !== job.community_post_id ||
                          communityPostCard.status === "loading" ? (
                            <div className="flex gap-3 animate-pulse">
                              <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl bg-muted" />
                              <div className="flex-1 space-y-2 pt-1">
                                <div className="h-4 w-3/4 rounded bg-muted" />
                                <div className="h-3 w-full rounded bg-muted" />
                                <div className="h-3 w-2/3 rounded bg-muted" />
                              </div>
                            </div>
                          ) : communityPostCard.status === "ready" ? (
                            <div className="space-y-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                From availability post
                              </p>
                              <div className="flex gap-3 rounded-xl border border-border/50 bg-background/40 p-3 dark:bg-black/20">
                                <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                                  {communityPostCard.coverUrl ? (
                                    <img
                                      src={communityPostCard.coverUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                      {job.service_type === "cleaning" ? (
                                        <Sparkles className="h-6 w-6" />
                                      ) : job.service_type === "cooking" ? (
                                        <UtensilsCrossed className="h-6 w-6" />
                                      ) : job.service_type === "pickup_delivery" ? (
                                        <Truck className="h-6 w-6" />
                                      ) : job.service_type === "nanny" ? (
                                        <Baby className="h-6 w-6" />
                                      ) : (
                                        <Briefcase className="h-6 w-6" />
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  {communityPostCard.categoryLabel && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                      {communityPostCard.categoryLabel}
                                    </span>
                                  )}
                                  <h4 className="text-[15px] font-bold leading-snug text-slate-900 dark:text-white line-clamp-2">
                                    {communityPostCard.title}
                                  </h4>
                                  {communityPostCard.blurb ? (
                                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                      {communityPostCard.blurb}
                                    </p>
                                  ) : null}
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate font-medium">{job.location_city}</span>
                                  </div>
                                  {communityPostCard.expiresAt ? (
                                    <ExpiryCountdown
                                      expiresAtIso={communityPostCard.expiresAt}
                                      endedLabel="Post ended"
                                      className="text-xs"
                                    />
                                  ) : null}
                                  <Link
                                    to={`/public/posts?post=${job.community_post_id}`}
                                    className="inline-block text-xs font-bold text-primary underline-offset-2 hover:underline"
                                  >
                                    Open in feed
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ) : null
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                {job.service_type === 'cleaning' && <Sparkles className="w-5 h-5 text-primary" />}
                                {job.service_type === 'cooking' && <UtensilsCrossed className="w-5 h-5 text-primary" />}
                                {job.service_type === 'pickup_delivery' && <Truck className="w-5 h-5 text-primary" />}
                                {job.service_type === 'nanny' && <Baby className="w-5 h-5 text-primary" />}
                                {(!job.service_type || job.service_type === 'other_help') && <Briefcase className="w-5 h-5 text-primary" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-lg font-bold leading-tight truncate text-slate-900 dark:text-white">{formatJobTitle(job)}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-600 dark:text-white/70">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-sm font-medium">{job.location_city}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-3.5 border-t border-border/30">
                              {job.start_at && (
                                <div className="flex items-center gap-2.5">
                                  <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium leading-tight text-black dark:text-white">{formatDateTimeSimple(job.start_at)}</span>
                                </div>
                              )}

                              {job.time_duration && (
                                <div className="flex items-center gap-2.5">
                                  <Hourglass className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium capitalize text-black dark:text-white">{job.time_duration.replace(/_/g, ' ')}</span>
                                </div>
                              )}

                              {job.care_frequency && (
                                <div className="flex items-center gap-2.5">
                                  <Repeat className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium capitalize text-black dark:text-white">{job.care_frequency.replace(/_/g, ' ')}</span>
                                </div>
                              )}

                              {(Number(job.children_count) > 0 || job.service_type === 'nanny') && (
                                <div className="flex items-center gap-2.5">
                                  <Baby className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium text-black dark:text-white">
                                    {Number(job.children_count) || 0} {job.children_age_group ? `(${formatAgeGroup(job.children_age_group as string)})` : ''} kids
                                  </span>
                                </div>
                              )}

                              {formatServiceDetails(job.service_details, job.service_type as string)}
                            </div>

                            {job.service_details?.custom && (
                              <div className="flex flex-col gap-1.5 mt-2 w-full bg-orange-500 rounded-xl px-4 py-3 border-none shadow-sm">
                                <span className="font-bold text-white/90 text-[10px] uppercase tracking-widest flex items-center gap-2 underline underline-offset-4 decoration-white/20">
                                  <AlignLeft className="w-3 h-3" />
                                  NOTES
                                </span>
                                <p className="text-white text-sm font-medium leading-relaxed">
                                  {job.service_details.custom}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Floating Mobile Chat Toggle - Round button fixed to the right side */}
          {!hideBackButton && (
            <div className="lg:hidden fixed right-4 top-1/2 -translate-y-1/2 z-50">
              <Button
                onClick={() => setMobileView("chat")}
                className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-primary hover:bg-primary/90 flex items-center justify-center border-none"
                size="icon"
              >
                <Send className="w-6 h-6 text-white" />
              </Button>
            </div>
          )}
        </div>
      )
      }
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-opacity duration-300 relative",
        // On mobile: hide when 'steps' view is active
        !hideBackButton && mobileView === "steps" && "hidden lg:flex"
      )}>
        {/* Header - Fixed */}
        <header className="flex-shrink-0 border-none bg-card/80 dark:bg-background/80 backdrop-blur-md px-4 py-3 md:relative fixed top-0 left-0 right-0 z-20 md:z-auto md:top-auto shadow-sm">
          <div className="flex items-center gap-3">
            {!hideBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  // On mobile, go back to steps; on desktop, navigate to messages
                  if (window.innerWidth < 1024) {
                    setMobileView("steps");
                  } else {
                    navigate("/messages");
                  }
                }}
                className="lg:hidden text-black dark:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToOtherPublicProfile();
              }}
              disabled={!otherUser?.id}
              className="rounded-full shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              aria-label={otherUser?.id ? `View ${otherUser.full_name || "user"} public profile` : undefined}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={otherUser?.photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {otherInitials}
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !hideBackButton && setShowContactPanel(!showContactPanel)}>
              <h2 className="text-[18px] font-bold truncate text-black dark:text-white">
                {conversation?.job_id === null
                  ? (currentUserProfile?.is_admin ? (otherUser?.full_name || "User") : "Support")
                  : (otherUser?.full_name || "User")}
              </h2>
              {!hideBackButton && (
                <p className="text-[13px] font-medium text-black/60 dark:text-white/60">
                  {otherUser?.id ? "Tap name for contact info" : "Tap for contact info"}
                </p>
              )}
            </div>

            {!hideBackButton && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Phone call functionality
                    console.log("Call", otherUser?.full_name);
                  }}
                  className="text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                >
                  <Phone className="w-5 h-5" />
                </Button>
                {showWhatsApp && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (otherUser?.whatsapp_number_e164) {
                        window.open(getWhatsAppLink(otherUser.whatsapp_number_e164), '_blank');
                      }
                    }}
                    title="Open WhatsApp"
                  >
                    <WhatsAppIcon className="w-5 h-5 fill-[#25D366]" />
                  </Button>
                )}
                {showTelegram && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (otherUser?.telegram_username) {
                        window.open(getTelegramLink(otherUser.telegram_username), '_blank');
                      }
                    }}
                    title="Open Telegram"
                  >
                    <TelegramIcon className="w-5 h-5 fill-[#0088cc]" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 pt-20 md:pt-4"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            <div className="space-y-4 w-full max-w-none px-2 md:px-4 pb-40 md:pb-32">
              {messages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const receiptStatus = getReadReceiptStatus(msg);

                return (
                  <div key={msg.id} className="space-y-4">
                    {shouldShowDateHeader(index) && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex items-end gap-2",
                        isOwn ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {!isOwn && (
                        <Avatar className="w-10 h-10 flex-shrink-0 mb-1">
                          <AvatarImage src={otherUser?.photo_url || undefined} />
                          <AvatarFallback className="text-[12px] font-bold bg-primary/10 text-primary">
                            {otherInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={cn(
                          "max-w-[85%] md:max-w-[70%] space-y-1",
                          isOwn ? "items-end" : "items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl shadow-sm relative group",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-card border border-border/50 rounded-bl-none"
                          )}
                        >
                          {/* Attachment Display */}
                          {msg.attachment_url && (
                            <div className="mb-2">
                              {msg.attachment_type === "image" ? (
                                <div
                                  className="relative cursor-pointer group/image transition-transform active:scale-[0.98]"
                                  onClick={() => {
                                    setSelectedImage(msg);
                                    setIsImageModalOpen(true);
                                  }}
                                >
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_name || "Attachment"}
                                    className="max-w-full rounded-lg hover:brightness-90 transition-all border border-black/5"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity bg-black/10 rounded-lg">
                                    <ImageIcon className="w-8 h-8 text-white drop-shadow-md" />
                                  </div>
                                </div>
                              ) : msg.attachment_type === "video" ? (
                                <video
                                  src={msg.attachment_url}
                                  controls
                                  className="max-w-full rounded-lg border border-border"
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors border border-dashed border-primary/20"
                                >
                                  <File className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-medium underline truncate max-w-[150px]">
                                    {msg.attachment_name || "Download File"}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}

                          {msg.body && (
                            <p className="text-[17px] font-medium leading-relaxed break-words whitespace-pre-wrap">
                              {msg.body}
                            </p>
                          )}

                          {/* Meta info inside message bubble */}
                          <div className={cn(
                            "flex items-center gap-1.5 mt-1",
                            isOwn ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-[10px]",
                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isOwn && receiptStatus && (
                              <ReadReceipt status={receiptStatus} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Send className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile composer — fixed bottom bar (/chat/ has no app bottom nav) */}
        <div
          className={cn(
            "lg:hidden fixed left-0 right-0 z-30 bottom-0",
            "bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.35)]",
            "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            !hideBackButton && mobileView === "steps" && "hidden"
          )}
        >
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/50 text-foreground">
              {getFileType(selectedFile.name) === "image" ? (
                <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <File className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={removeSelectedFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2 items-center w-full max-w-none">
            <input
              ref={fileInputRef}
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 flex-shrink-0 bg-muted hover:bg-muted/80 border border-border text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
            >
              <Paperclip className="w-6 h-6" />
            </Button>
            <Input
              ref={inputRef}
              placeholder={selectedFile ? "Add a message..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 rounded-full border border-border bg-background h-12 text-[16px] font-medium text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring/30"
              disabled={sending || uploading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-12 w-12 flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 shadow-sm"
              disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            >
              {sending || uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>

        {/* Desktop composer — bottom of viewport, inset for jobs side panel when present */}
        <div
          className={cn(
            "hidden lg:flex lg:flex-col fixed z-30 bottom-0 right-0",
            "bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.35)]",
            "px-6 pt-3 pb-4",
            hideBackButton ? "left-0" : "left-[400px]"
          )}
        >
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/50 text-foreground w-full max-w-none w-full">
              {getFileType(selectedFile.name) === "image" ? (
                <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <File className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={removeSelectedFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2 w-full max-w-none w-full items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 flex-shrink-0 bg-muted hover:bg-muted/80 border border-border text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
            >
              <Paperclip className="w-6 h-6" />
            </Button>
            <Input
              placeholder={selectedFile ? "Add a message..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 rounded-full border border-border bg-background h-12 text-[16px] font-medium text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring/30"
              disabled={sending || uploading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-12 w-12 flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 shadow-sm"
              disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            >
              {sending || uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Overlay for mobile contact panel */}
      {
        !hideBackButton && showContactPanel && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setShowContactPanel(false)}
          />
        )
      }

      {/* Image Modal */}
      {
        selectedImage && selectedImage.attachment_url && (
          <ImageModal
            isOpen={isImageModalOpen}
            onClose={() => {
              setIsImageModalOpen(false);
              setSelectedImage(null);
            }}
            currentImage={{
              id: selectedImage.id,
              attachment_url: selectedImage.attachment_url,
              attachment_name: selectedImage.attachment_name || null,
              sender_id: selectedImage.sender_id,
              created_at: selectedImage.created_at,
            }}
            allImages={messages
              .filter((m) => m.attachment_url && m.attachment_type === "image")
              .map((m) => ({
                id: m.id,
                attachment_url: m.attachment_url!,
                attachment_name: m.attachment_name || null,
                sender_id: m.sender_id,
                created_at: m.created_at,
              }))}
            onImageSelect={(image) => {
              const found = messages.find((m) => m.id === image.id);
              if (found && found.attachment_url) setSelectedImage(found);
            }}
          />
        )}

      {/* Modals outside main layout */}
      <Dialog open={showReviseModal} onOpenChange={setShowReviseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Schedule</DialogTitle>
            <DialogDescription>
              Propose a new date and time for this job
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Date</Label>
              <SimpleCalendar
                selectedDate={reviseDate}
                onDateSelect={setReviseDate}
                minDate={new Date()}
                unavailableTimeSlots={[
                  ...freelancerUnavailableTimeSlots.map(date => ({ date, start_time: "00:00", end_time: "23:59" })),
                  ...scheduledJobs
                    .filter(j => j.start_at)
                    .map(j => ({
                      date: new Date(j.start_at!).toISOString().split('T')[0],
                      start_time: new Date(j.start_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                      end_time: "23:59"
                    }))
                ]}
              />
            </div>
            {reviseDate && (
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={reviseTime}
                  onChange={(e) => setReviseTime(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowReviseModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!conversationId || !user || !reviseDate || !reviseTime) return;
                  setRevisePending(true);
                  try {
                    const [hours, minutes] = reviseTime.split(":");
                    const reviseDateTime = new Date(reviseDate);
                    reviseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    const reviseMessage = `🔄 Schedule Revision: ${reviseDateTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${reviseDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
                    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: reviseMessage });
                    if (error) throw error;
                    setShowReviseModal(false);
                    setRevisePending(false);
                    addToast({ title: "Revision request sent", description: "The client will review your proposed schedule.", variant: "success" });
                  } catch (err: any) {
                    console.error("Error sending revision request:", err);
                    addToast({ title: "Failed to send", description: err?.message || "Could not send revision request.", variant: "error" });
                    setRevisePending(false);
                  }
                }}
                disabled={revisePending || !reviseDate || !reviseTime}
              >
                {revisePending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                {revisePending ? "Sending..." : "Send Revision"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payment Request</DialogTitle>
            <DialogDescription>
              Enter payment details and select currency
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="payment-currency-select">Currency</Label>
              <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                <SelectTrigger id="payment-currency-select" className="mt-2">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.icon} {currency.name} ({currency.iso})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-hours-input">Hours Worked</Label>
              <Input
                id="payment-hours-input"
                type="number"
                step="0.5"
                min="0.5"
                placeholder="e.g., 4.5"
                value={paymentHoursInput}
                onChange={(e) => {
                  setPaymentHoursInput(e.target.value);
                  const hours = parseFloat(e.target.value) || 0;
                  const rate = parseFloat(paymentHourlyRateInput) || priceOffer || job?.offered_hourly_rate || 0;
                  const subtotal = hours * rate;
                  const vatRate = 0.18;
                  const vat = subtotal * vatRate;
                  const total = subtotal + vat;
                  setPaymentHourlyRate(rate);
                  setPaymentTotal(total);
                }}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="payment-hourly-rate-input">Hourly Rate (Can be changed)</Label>
              <Input
                id="payment-hourly-rate-input"
                type="number"
                step="0.01"
                min="0"
                placeholder={priceOffer || job?.offered_hourly_rate ? `Default: ${priceOffer || job?.offered_hourly_rate}` : "Enter hourly rate"}
                value={paymentHourlyRateInput}
                onChange={(e) => {
                  setPaymentHourlyRateInput(e.target.value);
                  const rate = parseFloat(e.target.value) || 0;
                  const hours = parseFloat(paymentHoursInput) || 0;
                  const subtotal = hours * rate;
                  const vatRate = 0.18;
                  const vat = subtotal * vatRate;
                  const total = subtotal + vat;
                  setPaymentHourlyRate(rate);
                  setPaymentTotal(total);
                }}
                className="mt-2"
              />
            </div>

            {paymentHoursInput && parseFloat(paymentHoursInput) > 0 && paymentHourlyRateInput && parseFloat(paymentHourlyRateInput) > 0 && selectedCurrencyId && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hourly Rate:</span>
                  <span className="font-medium">
                    {currencies.find(c => c.id === selectedCurrencyId)?.icon || "$"}
                    {paymentHourlyRate.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total:</span>
                  <span>
                    {currencies.find(c => c.id === selectedCurrencyId)?.icon || "$"}
                    {paymentTotal.toFixed(2)} {currencies.find(c => c.id === selectedCurrencyId)?.iso || ""}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentHoursInput("");
                  setPaymentHourlyRateInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!conversationId || !user || !job || paymentPending) return;
                  if (!selectedCurrencyId) {
                    addToast({ title: "Currency required", description: "Please select a currency.", variant: "error" });
                    return;
                  }
                  const hours = parseFloat(paymentHoursInput) || 0;
                  if (isNaN(hours) || hours <= 0) {
                    addToast({ title: "Invalid hours", description: "Please enter a valid number of hours.", variant: "error" });
                    return;
                  }
                  const rate = parseFloat(paymentHourlyRateInput) || priceOffer || job.offered_hourly_rate || 0;
                  if (isNaN(rate) || rate <= 0) {
                    addToast({ title: "Invalid hourly rate", description: "Please enter a valid hourly rate.", variant: "error" });
                    return;
                  }
                  setPaymentPending(true);
                  try {
                    const vatRate = 0.18;
                    const subtotal = hours * rate;
                    const vat = subtotal * vatRate;
                    const total = subtotal + vat;
                    const { data: paymentData, error: paymentError } = await supabase.from("payments").insert({ job_id: job.id, freelancer_id: conversation?.freelancer_id || user.id, client_id: conversation?.client_id || "", currency_id: selectedCurrencyId, hours_worked: hours, hourly_rate: rate, subtotal: subtotal, vat_rate: vatRate * 100, vat_amount: vat, total_amount: total, status: "pending" }).select(`*, currency:currencies(id, name, iso, icon)`).single();
                    if (paymentError) throw paymentError;
                    if (paymentData) {
                      setPaymentHourlyRate(paymentData.hourly_rate);
                      setPaymentTotal(paymentData.total_amount);
                    }
                    await supabase.from("job_requests").update({ stage: "Payment" }).eq("id", job.id);
                    const currencyIcon = currencies.find(c => c.id === selectedCurrencyId)?.icon || "$";
                    const currencyIso = currencies.find(c => c.id === selectedCurrencyId)?.iso || "";
                    const paymentMessage = `💰 Payment Request: ${hours} hours × ${currencyIcon}${rate.toFixed(2)}/hr = ${currencyIcon}${total.toFixed(2)} ${currencyIso} (incl. VAT 18%)`;
                    await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: paymentMessage });
                    setShowPaymentModal(false);
                    setPaymentHoursInput("");
                    setPaymentHourlyRateInput("");
                    addToast({ title: "Payment request sent", description: `Payment request of ${currencyIcon}${total.toFixed(2)} ${currencyIso} has been sent.` });
                  } catch (error) {
                    console.error("Error creating payment:", error);
                    addToast({ title: "Error", description: "Failed to create payment request.", variant: "error" });
                  } finally {
                    setPaymentPending(false);
                  }
                }}
                disabled={paymentPending || !paymentHoursInput || parseFloat(paymentHoursInput) <= 0}
              >
                {paymentPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Create Payment Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevisePriceModal} onOpenChange={setShowRevisePriceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Price Offer</DialogTitle>
            <DialogDescription>
              Send a new hourly rate offer to the client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="revise-price-input">New Hourly Rate ($)</Label>
              <Input id="revise-price-input" type="number" placeholder="e.g., 25" value={priceOfferInput} onChange={(e) => setPriceOfferInput(e.target.value)} min="1" className="mt-2" />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setShowRevisePriceModal(false); setPriceOfferInput(""); }}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!conversationId || !user || !priceOfferInput || !job || priceOfferPending) return;
                  const offerAmount = parseInt(priceOfferInput);
                  if (isNaN(offerAmount) || offerAmount < 1) {
                    addToast({ title: "Invalid amount", description: "Please enter a valid hourly rate.", variant: "error" });
                    return;
                  }
                  setPriceOfferPending(true);
                  try {
                    await supabase.from("job_requests").update({ offered_hourly_rate: offerAmount, price_offer_status: "pending", stage: "Price Offer" }).eq("id", job.id);
                    const priceMessage = `💰 Price Offer: $${offerAmount}/hour`;
                    await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: priceMessage });
                    setPriceOffer(offerAmount);
                    setPriceOfferInput("");
                    setShowRevisePriceModal(false);
                    addToast({ title: "Price offer sent", description: `Your new offer of $${offerAmount}/hour has been sent.` });
                  } catch (error) {
                    console.error("Error sending price offer:", error);
                    addToast({ title: "Error", description: "Failed to send price offer.", variant: "error" });
                  } finally {
                    setPriceOfferPending(false);
                  }
                }}
                disabled={priceOfferPending || !priceOfferInput}
              >
                {priceOfferPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Send New Offer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
