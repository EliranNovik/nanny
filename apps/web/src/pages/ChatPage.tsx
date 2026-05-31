import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Loader2,
  Clock,
  File,
  ImageIcon,
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
import { glassBadgeClass, glassIconButtonClass } from "@/lib/glassBadge";
import { useToast } from "@/components/ui/toast";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { ImageModal } from "@/components/ImageModal";
import { Badge } from "@/components/ui/badge";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { useQueryClient } from "@tanstack/react-query";
import { useMessagesRealtime, usePaymentsRealtime } from "@/hooks/useMessagesRealtime";
import {
  patchChatThreadMessages,
  useChatThread,
} from "@/hooks/data/useChatThread";
import { queryKeys } from "@/hooks/data/keys";
import { writeThreadCache } from "@/lib/messagesCache";
import { useJobRequestsRealtime } from "@/hooks/useJobRequestsRealtime";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatFloatingProfileHeader } from "@/components/messages/ChatFloatingProfileHeader";
import { useChatHeaderAvatarStatus } from "@/hooks/useChatHeaderAvatarStatus";
import {
  ChatParticipantProfilePeek,
  type ChatParticipantProfile,
} from "@/components/messages/ChatParticipantProfilePeek";
import { getTelegramLink, getWhatsAppLink } from "@/lib/socialContactLinks";
import { ChatLinkPreviewCards } from "@/components/chat/ChatLinkPreviewCards";
import { MatchContextBanner } from "@/components/messages/MatchContextBanner";
import { ChatJobContextStrip } from "@/components/messages/ChatJobContextStrip";
import {
  isLikelySystemMessage,
  jobCategoryLabel,
  type JobSummaryRow,
} from "@/lib/chatJobContext";
import { getLiveJobBannerFromRow } from "@/lib/liveJobConversationBanner";
import { parseMatchIntroBody } from "@/lib/matchIntroMessage";
import { trackEvent } from "@/lib/analytics";
import { consumePendingChatOpen } from "@/lib/sessionConversionAnalytics";
import { bodyHasNonPreviewText } from "@/lib/chatBodyPreviewText";
import {
  extractChatUrlsFromText,
  linkifyMessageBody,
  previewHrefOmitSet,
} from "@/lib/linkifyMessageBody";

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
  is_verified?: boolean | null;
}

interface Job {
  id: string;
  client_id: string;
  selected_freelancer_id: string | null;
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
  /** When embedded in Messages, false while the mobile chat column is `display:none`. */
  chatPaneVisible?: boolean;
}

export default function ChatPage({
  conversationId: propConversationId,
  hideBackButton = false,
  otherUserId: propOtherUserId,
  chatPaneVisible = true,
}: ChatPageProps = {}) {
  const { conversationId: paramConversationId } = useParams<{
    conversationId?: string;
  }>();
  const conversationId = propConversationId || paramConversationId;
  const { user, profile: currentUserProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const matchBannerActive = searchParams.get("mma") === "1";
  const matchCatRaw = searchParams.get("mc");
  const matchLocRaw = searchParams.get("ml");
  const matchTimeRaw = searchParams.get("mt");
  const matchCategoryLabel = matchCatRaw
    ? decodeURIComponent(matchCatRaw)
    : "";
  const matchLocationLabel = matchLocRaw
    ? decodeURIComponent(matchLocRaw)
    : "";
  const matchTimeLabel = matchTimeRaw
    ? decodeURIComponent(matchTimeRaw)
    : "";
  const [matchActionBusy, setMatchActionBusy] = useState(false);

  useEffect(() => {
    if (conversationId) consumePendingChatOpen(conversationId);
  }, [conversationId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const mobileComposerRef = useRef<HTMLTextAreaElement>(null);
  const desktopComposerRef = useRef<HTMLTextAreaElement>(null);

  function focusComposer() {
    requestAnimationFrame(() => {
      const isLg =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 1024px)").matches;
      if (isLg) desktopComposerRef.current?.focus();
      else mobileComposerRef.current?.focus();
    });
  }



  function adjustComposerHeight() {
    const maxPx =
      typeof window !== "undefined"
        ? Math.min(window.innerHeight * 0.4, 280)
        : 280;
    const minLine = 48;
    const isLg =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    const el = isLg ? desktopComposerRef.current : mobileComposerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(Math.max(el.scrollHeight, minLine), maxPx);
    el.style.height = `${h}px`;
  }
  const { addToast } = useToast();
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<"steps" | "chat">("steps"); // Default to steps on mobile

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const clearMatchUrlParams = useCallback(() => {
    const n = new URLSearchParams(searchParams);
    n.delete("mma");
    n.delete("mc");
    n.delete("ml");
    n.delete("mt");
    setSearchParams(n, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleMatchAccept = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    setMatchActionBusy(true);
    try {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: "✓ Match accepted. Let's coordinate!",
      });
      trackEvent("match_accept", {});
      clearMatchUrlParams();
    } catch (e) {
      console.error(e);
    } finally {
      setMatchActionBusy(false);
    }
  }, [conversationId, user?.id, clearMatchUrlParams]);

  const handleMatchDecline = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    setMatchActionBusy(true);
    try {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: "Declined this match for now.",
      });
      trackEvent("match_decline", {});
      clearMatchUrlParams();
    } finally {
      setMatchActionBusy(false);
    }
  }, [conversationId, user?.id, clearMatchUrlParams]);

  const queryClient = useQueryClient();
  const threadQuery = useChatThread(conversationId, user?.id, propOtherUserId);
  const threadKey = queryKeys.chatThread(user?.id, conversationId);

  const [realtimeConvoIds, setRealtimeConvoIds] = useState<string[]>(
    conversationId ? [conversationId] : [],
  );
  const [realtimeJobId, setRealtimeJobId] = useState<string | null>(null);

  const loading = threadQuery.isPending && !threadQuery.data;

  useMessagesRealtime({
    conversationIds: realtimeConvoIds,
    onMessageChange: async (_payload) => {
      const payload = _payload as any;
      if (payload.event === "INSERT") {
        const newMsg = payload.new as Message;
        patchChatThreadMessages(queryClient, threadKey, (prev) => {
          if (prev.some((msg) => msg.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });

        if (newMsg.sender_id !== user?.id) {
          markMessagesAsRead([newMsg.id]);
        }

        if (
          newMsg.body?.includes("Schedule confirmed") ||
          newMsg.body?.includes("✓ Schedule confirmed")
        ) {
          const jSch = jobRef.current;
          if (currentUserProfile?.role === "client" && jSch) {
            supabase
              .from("job_requests")
              .update({ schedule_confirmed: true, stage: "Schedule" })
              .eq("id", jSch.id)
              .then(({ error }) => {
                if (error)
                  console.error(
                    "Error updating schedule_confirmed:",
                    error,
                  );
              });
          }
        }

        if (newMsg.body?.includes("💰 Price Offer")) {
          const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
          if (priceMatch) {
            setPriceOffer(parseInt(priceMatch[1]));
          }
        }

        if (newMsg.body?.includes("💰 Payment Request")) {
          const jReq = jobRef.current;
          if (currentUserProfile?.role === "client" && jReq) {
            const { data: paymentData } = await supabase
              .from("payments")
              .select("*")
              .eq("job_id", jReq.id)
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

        if (
          newMsg.body?.includes("Payment accepted") ||
          newMsg.body?.includes("✓ Payment accepted") ||
          newMsg.body?.includes("Payment completed") ||
          newMsg.body?.includes("✓ Payment completed")
        ) {
          const jAcc = jobRef.current;
          if (jAcc) {
            const { data: paymentData } = await supabase
              .from("payments")
              .select("*")
              .eq("job_id", jAcc.id)
              .in("status", ["accepted", "paid"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (paymentData) {
              setPaymentTotal(paymentData.total_amount);
            }
          }
        }
      } else if (payload.event === "UPDATE") {
        const updatedMsg = payload.new as Message;
        patchChatThreadMessages(queryClient, threadKey, (prev) =>
          prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg)),
        );
        setMessages((prev) =>
          prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg)),
        );
      }
    }
  });

  usePaymentsRealtime({
    conversationIds: realtimeConvoIds,
    onPaymentChange: async (payload) => {
      const paymentJobId = payload.new.job_id;
      const j = jobRef.current;
      if (j && paymentJobId === j.id) {
        const paymentData = payload.new;
        setPaymentHourlyRate(paymentData.hourly_rate);
        setPaymentTotal(paymentData.total_amount);

        if (payload.event === "UPDATE" && paymentData.status === "paid" && j.stage !== "Completed") {
          const { error: jobError } = await supabase
            .from("job_requests")
            .update({ stage: "Completed" })
            .eq("id", j.id);

          if (!jobError) {
            setJob((prev) =>
              prev ? { ...prev, stage: "Completed" } : prev,
            );
          }
        }
      }
    }
  });

  useJobRequestsRealtime({
    jobId: realtimeJobId ?? undefined,
    onJobUpdate: async (payload) => {
      const j = jobRef.current;
      if (
        j &&
        payload.new.id === j.id &&
        (payload.new.stage === "Payment" ||
          payload.new.stage === "Completed")
      ) {
        setJob((prev) =>
          prev ? { ...prev, stage: payload.new.stage as string } : prev,
        );

        const { data: existingPayment } = await supabase
          .from("payments")
          .select("*")
          .eq("job_id", j.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingPayment) {
          setPaymentHourlyRate(existingPayment.hourly_rate);
          setPaymentTotal(existingPayment.total_amount);
        }
      }
    }
  });

  useLayoutEffect(() => {
    adjustComposerHeight();
  }, [newMessage]);
  useEffect(() => {
    const onResize = () => adjustComposerHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [sending, setSending] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<Message | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  // Job details state
  const [job, setJob] = useState<Job | null>(null);
  const [communityPostCard, setCommunityPostCard] =
    useState<CommunityPostCardState | null>(null);
  const [priceOffer, setPriceOffer] = useState<number | null>(null);

  // Revise schedule state
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseDate, setReviseDate] = useState<Date | null>(null);
  const [reviseTime, setReviseTime] = useState("");
  const [revisePending, setRevisePending] = useState(false);
  const [freelancerUnavailableTimeSlots, setFreelancerUnavailableTimeSlots] =
    useState<string[]>([]);
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
  const [reportConversations, setReportConversations] = useState<
    ReportConversation[]
  >([]);

  /** Latest job for realtime handlers — do NOT put `job` in the main subscription effect deps (causes refetch loops). */
  const jobRef = useRef<Job | null>(null);
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  const liveJobBanner = useMemo(
    () =>
      job && user?.id && job.client_id
        ? getLiveJobBannerFromRow(
            {
              status: job.status,
              service_type: job.service_type,
              care_type: job.care_type,
              client_id: job.client_id,
              selected_freelancer_id: job.selected_freelancer_id,
            },
            user.id,
          )
        : null,
    [job, user?.id],
  );

  useEffect(() => {
    if (threadQuery.isError && conversationId) {
      navigate("/");
    }
  }, [threadQuery.isError, conversationId, navigate]);

  useLayoutEffect(() => {
    const payload = threadQuery.data;
    if (!payload || !user?.id || !conversationId) return;

    if (lastHydratedConversationRef.current !== conversationId) {
      isInitialLoadRef.current = true;
      stickToBottomRef.current = true;
      anchorBottomUntilRef.current = Date.now() + 4500;
      lastHydratedConversationRef.current = conversationId;
    }

    setConversation(payload.conversation);
    setOtherUser(payload.otherUser as Profile | null);
    setJob((payload.job as Job | null) ?? null);
    setMessages(payload.messages as Message[]);
    setRealtimeJobId(payload.conversation.job_id);

    setRealtimeConvoIds((prev) => {
      const next =
        payload.realtimeConvoIds.length > 0
          ? payload.realtimeConvoIds
          : [conversationId];
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });

    writeThreadCache(user.id, conversationId, payload);
  }, [threadQuery.data, conversationId, user?.id]);

  useEffect(() => {
    const payload = threadQuery.data;
    if (!payload || !user?.id || !conversationId) return;

    void fetchCurrencies();
    if (currentUserProfile?.is_admin && payload.conversation.job_id === null) {
      void fetchReportConversations();
    }

    const otherId = payload.otherUserId;
    if (payload.conversation.job_id && payload.otherUser?.role === "freelancer") {
      void (async () => {
        const [{ data: unavailableDates }, { data: schedJobs }] =
          await Promise.all([
            supabase
              .from("freelancer_unavailable_dates")
              .select("unavailable_date, start_time, end_time")
              .eq("freelancer_id", otherId),
            supabase
              .from("job_requests")
              .select("*")
              .eq("selected_freelancer_id", otherId)
              .eq("status", "locked"),
          ]);
        if (unavailableDates?.length) {
          const days = Array.from(
            new Set(
              unavailableDates
                .map(
                  (d: { unavailable_date: string | null }) =>
                    d.unavailable_date,
                )
                .filter(Boolean),
            ),
          ) as string[];
          setFreelancerUnavailableTimeSlots(days);
        }
        if (schedJobs) setScheduledJobs(schedJobs);
      })();
    } else if (!payload.conversation.job_id) {
      setFreelancerUnavailableTimeSlots([]);
      setScheduledJobs([]);
    }
  }, [
    threadQuery.data,
    conversationId,
    user?.id,
    currentUserProfile?.is_admin,
  ]);

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
        .select(
          `
          id,
          client_id,
          created_at
        `,
        )
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
            .select(
              "id, full_name, photo_url, city, phone, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram",
            )
            .eq("id", conv.client_id)
            .single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select(
              "id, conversation_id, sender_id, body, created_at, read_at, read_by",
            )
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
        }),
      );

      // Filter out null values (conversations without client profiles)
      const validReports = reportsWithDetails.filter(
        (r): r is NonNullable<typeof r> => r !== null,
      );
      setReportConversations(validReports);
    } catch (error) {
      console.error("Error fetching report conversations:", error);
    }
  }

  async function markMessagesAsRead(messageIds: string[]) {
    if (!user || markingRead || messageIds.length === 0) return;
    setMarkingRead(true);

    try {
      const { data, error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString(), read_by: user.id })
        .in("id", messageIds)
        .is("read_at", null)
        .select();

      if (error) {
        console.error("[ChatPage] Error marking messages as read:", error);
        setMessages((prev) =>
          prev.map((msg) => {
            if (
              messageIds.includes(msg.id) &&
              msg.sender_id !== user.id &&
              !msg.read_at
            ) {
              return {
                ...msg,
                read_at: new Date().toISOString(),
                read_by: user.id,
              };
            }
            return msg;
          }),
        );
      } else if (data?.length) {
        const byId = new Map(data.map((m) => [m.id, m as Message]));
        setMessages((prev) =>
          prev.map((msg) =>
            byId.has(msg.id) ? (byId.get(msg.id) as Message) : msg,
          ),
        );
      }
    } catch (error) {
      console.error("[ChatPage] Error marking messages as read:", error);
    } finally {
      setMarkingRead(false);
    }
  }

  const isInitialLoadRef = useRef(true);
  const pendingSmoothScrollRef = useRef(false);
  const lastAnchoredMessageCountRef = useRef(0);
  const stickToBottomRef = useRef(true);
  const anchorBottomUntilRef = useRef(0);
  const lastHydratedConversationRef = useRef<string | null>(null);
  const isAnchoringRef = useRef(false);
  const anchorTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shouldStickToBottom = useCallback(() => {
    return stickToBottomRef.current || Date.now() < anchorBottomUntilRef.current;
  }, []);

  const clearAnchorTimers = useCallback(() => {
    for (const id of anchorTimersRef.current) clearTimeout(id);
    anchorTimersRef.current = [];
  }, []);

  /** Scroll the thread container to the latest message (not `scrollIntoView` — unreliable on iOS). */
  const scrollToBottom = useCallback((smooth = false): boolean => {
    const root = scrollRef.current;
    if (!root || root.clientHeight <= 0) return false;

    const top = Math.max(0, root.scrollHeight - root.clientHeight);
    if (smooth) {
      root.scrollTo({ top, behavior: "smooth" });
    } else {
      root.scrollTop = top;
    }
    return true;
  }, []);

  const runBottomAnchorPass = useCallback(
    (smooth = false) => {
      clearAnchorTimers();
      isAnchoringRef.current = true;
      stickToBottomRef.current = true;

      const attempt = () => {
        if (shouldStickToBottom()) scrollToBottom(smooth);
      };

      attempt();
      requestAnimationFrame(() => {
        attempt();
        requestAnimationFrame(attempt);
      });

      const delays = hideBackButton ? [0, 50, 120, 250, 450, 700] : [0, 120, 300];
      for (const ms of delays) {
        anchorTimersRef.current.push(setTimeout(attempt, ms));
      }
      anchorTimersRef.current.push(
        setTimeout(() => {
          isAnchoringRef.current = false;
        }, hideBackButton ? 750 : 350),
      );
    },
    [clearAnchorTimers, hideBackButton, scrollToBottom, shouldStickToBottom],
  );

  useEffect(() => {
    isInitialLoadRef.current = true;
    stickToBottomRef.current = true;
    lastAnchoredMessageCountRef.current = 0;
    lastHydratedConversationRef.current = null;
    anchorBottomUntilRef.current = Date.now() + 4500;
    clearAnchorTimers();
    return () => clearAnchorTimers();
  }, [conversationId, clearAnchorTimers]);

  const handleMessagesScroll = useCallback(() => {
    if (isAnchoringRef.current) return;

    const root = scrollRef.current;
    if (!root) return;
    const distanceFromBottom =
      root.scrollHeight - root.scrollTop - root.clientHeight;

    // While opening a thread, layout/images can briefly report a large gap — don't treat that as the user scrolling up.
    if (Date.now() < anchorBottomUntilRef.current) {
      if (distanceFromBottom < 48) stickToBottomRef.current = true;
      return;
    }

    if (distanceFromBottom > 96) {
      stickToBottomRef.current = false;
      anchorBottomUntilRef.current = 0;
      return;
    }
    if (distanceFromBottom < 48) {
      stickToBottomRef.current = true;
    }
  }, []);

  // Open chat already at the bottom (before paint). Smooth scroll only when sending.
  useLayoutEffect(() => {
    if (loading || !chatPaneVisible) return;

    if (messages.length === 0) {
      lastAnchoredMessageCountRef.current = 0;
      return;
    }

    if (isInitialLoadRef.current) {
      runBottomAnchorPass(false);
      isInitialLoadRef.current = false;
      lastAnchoredMessageCountRef.current = messages.length;
      pendingSmoothScrollRef.current = false;
      return;
    }

    const grew = messages.length > lastAnchoredMessageCountRef.current;
    lastAnchoredMessageCountRef.current = messages.length;

    if (
      (grew || pendingSmoothScrollRef.current) &&
      shouldStickToBottom()
    ) {
      runBottomAnchorPass(pendingSmoothScrollRef.current);
      pendingSmoothScrollRef.current = false;
    }
  }, [
    chatPaneVisible,
    loading,
    messages,
    runBottomAnchorPass,
    shouldStickToBottom,
  ]);

  // Images, job strip, and pane visibility can grow after first paint — keep pinned briefly.
  useLayoutEffect(() => {
    if (loading || messages.length === 0 || !chatPaneVisible) return;
    const root = scrollRef.current;
    const content = root?.firstElementChild;
    if (!root || !content) return;

    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    const maybeStick = () => {
      if (!chatPaneVisible || root.clientHeight <= 0) return;
      if (shouldStickToBottom()) runBottomAnchorPass(false);
    };

    const roContent = new ResizeObserver(() => maybeStick());
    roContent.observe(content);

    const roRoot = new ResizeObserver(() => maybeStick());
    roRoot.observe(root);

    t1 = setTimeout(maybeStick, 0);
    t2 = setTimeout(maybeStick, 120);

    return () => {
      roContent.disconnect();
      roRoot.disconnect();
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [
    chatPaneVisible,
    conversationId,
    loading,
    messages.length,
    runBottomAnchorPass,
    shouldStickToBottom,
  ]);

  const prevChatPaneVisibleRef = useRef(chatPaneVisible);
  // Embedded Messages: chat column may be `display:none` on first layout — anchor when it becomes visible.
  useLayoutEffect(() => {
    const becameVisible =
      hideBackButton &&
      chatPaneVisible &&
      !prevChatPaneVisibleRef.current;
    prevChatPaneVisibleRef.current = chatPaneVisible;
    if (!becameVisible || loading || messages.length === 0) return;
    stickToBottomRef.current = true;
    anchorBottomUntilRef.current = Date.now() + 4500;
    isInitialLoadRef.current = true;
    runBottomAnchorPass(false);
  }, [
    chatPaneVisible,
    hideBackButton,
    loading,
    messages.length,
    conversationId,
    runBottomAnchorPass,
  ]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onViewportChange = () => {
      if (shouldStickToBottom()) runBottomAnchorPass(false);
    };
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, [conversationId, runBottomAnchorPass, shouldStickToBottom]);

  const prevMobileViewRef = useRef(mobileView);
  useLayoutEffect(() => {
    if (hideBackButton || loading || messages.length === 0) return;
    const enteredChat =
      prevMobileViewRef.current !== "chat" && mobileView === "chat";
    prevMobileViewRef.current = mobileView;
    if (enteredChat) {
      stickToBottomRef.current = true;
      anchorBottomUntilRef.current = Date.now() + 4500;
      runBottomAnchorPass(false);
    }
  }, [
    mobileView,
    hideBackButton,
    loading,
    messages.length,
    runBottomAnchorPass,
  ]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) => msg.sender_id !== user.id && !msg.read_at,
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
    focusComposer();
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
    if (
      (!newMessage.trim() && !selectedFile) ||
      !conversationId ||
      !user ||
      sending ||
      uploading
    )
      return;

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
          if (
            uploadError.message?.includes("Bucket not found") ||
            uploadError.message?.includes("not found")
          ) {
            alert(
              "Storage bucket 'chat-attachments' not found. Please create it in Supabase Dashboard > Storage.",
            );
            console.error(
              "Bucket not found. Please create 'chat-attachments' bucket in Supabase Dashboard.",
            );
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

    patchChatThreadMessages(queryClient, threadKey, (prev) => [
      ...prev,
      optimisticMessage,
    ]);
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setSelectedFile(null);

    pendingSmoothScrollRef.current = true;
    isInitialLoadRef.current = false;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
      })
      .select()
      .single();

    if (error) {
      // Remove optimistic message and restore input
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(body || "");
      setSelectedFile(selectedFile);
      console.error("Error sending message:", error);
    } else if (data) {
      patchChatThreadMessages(queryClient, threadKey, (prev) =>
        prev.map((msg) => (msg.id === tempId ? (data as Message) : msg)),
      );
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? data : msg)),
      );
      const updatedThread = queryClient.getQueryData(threadKey);
      if (user?.id && conversationId && updatedThread) {
        writeThreadCache(user.id, conversationId, updatedThread);
      }
    }

    if (user?.id && currentUserProfile?.role) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messagesInbox(user.id, currentUserProfile.role),
      });
    }

    setSending(false);
    focusComposer();
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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
    if (typeof details === "string")
      return (
        <div className="col-span-2 flex items-start gap-2 text-foreground font-medium">
          <AlignLeft className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />{" "}
          {details}
        </div>
      );

    const formatValue = (val: any) => {
      if (typeof val !== "string") return String(val);
      // Replace underscore between digits with a hyphen, rest of underscores with spaces
      let formatted = val.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
      // For special keys, 'plus' -> '+'
      if (formatted.includes("plus")) {
        formatted = formatted.replace("plus", "+");
      }
      return formatted;
    };

    if (serviceType === "pickup_delivery") {
      return (
        <>
          {details.from_address && (
            <div className="flex items-start gap-2">
              <ArrowUpCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />{" "}
              <span className="font-medium text-foreground leading-tight text-sm truncate">
                {details.from_address} (From)
              </span>
            </div>
          )}
          {details.to_address && (
            <div className="flex items-start gap-2">
              <ArrowDownCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />{" "}
              <span className="font-medium text-foreground leading-tight text-sm truncate">
                {details.to_address} (To)
              </span>
            </div>
          )}
          {details.weight && (
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500 flex-shrink-0" />{" "}
              <span className="font-medium text-foreground capitalize text-sm">
                {formatValue(details.weight)} kg
              </span>
            </div>
          )}
        </>
      );
    }

    if (serviceType === "cleaning") {
      return (
        <>
          {details.home_size && (
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-orange-500 flex-shrink-0" />{" "}
              <span className="font-medium text-foreground capitalize text-sm">
                {formatValue(details.home_size)} size
              </span>
            </div>
          )}
        </>
      );
    }

    // fallback for generic JSON object
    return (
      <>
        {Object.entries(details).map(([key, value]) => {
          if (key === "custom") return null; // handled separately inside the main return
          // hide raw coordinates if they exist
          if (
            key === "from_lat" ||
            key === "from_lng" ||
            key === "to_lat" ||
            key === "to_lng"
          )
            return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="font-medium text-foreground capitalize text-sm">
                {formatValue(value)} {key.replace(/_/g, " ")}
              </span>
            </div>
          );
        })}
      </>
    );
  }

  function formatDateTimeSimple(dateStr: string | null): string {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatJobTitle(job: Job): string {
    if (job.service_type === "cleaning") return "Cleaning";
    if (job.service_type === "cooking") return "Cooking";
    if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
    if (job.service_type === "nanny") return "Nanny";
    if (job.service_type === "other_help") return "Other Help";

    return `Nanny – ${Number(job.children_count) || 0} kid${Number(job.children_count) !== 1 ? "s" : ""} (${job.children_age_group && job.children_age_group !== "null" ? formatAgeGroup(job.children_age_group) : "N/A"})`;
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

  /** Paragraph text inside bubbles; avoid `w-full` under flex+(items-end) or % width won’t constrain long URLs */
  const chatBubbleBodyTextCn =
    "block min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[19px] font-medium leading-snug md:text-[16px]";

  const chatAreaBgCn = "bg-zinc-100 dark:bg-background";
  const chatReceivedBubbleCn =
    "rounded-2xl rounded-bl-none border border-slate-200/80 bg-white text-slate-900 shadow-sm dark:border-none dark:bg-zinc-800 dark:text-zinc-100";

  /** Vivid glossy blue links in all chat bubbles (sent, received, system) — light + dark. */
  const chatBubbleLinkCn =
    "inline-block max-w-full align-text-top break-all font-semibold underline underline-offset-[3px] transition-colors duration-150 [overflow-wrap:anywhere] " +
    "text-[#0284c7] decoration-[#0ea5e9]/65 " +
    "drop-shadow-[0_0_6px_rgba(14,165,233,0.55)] " +
    "hover:text-[#0369a1] hover:decoration-[#38bdf8] " +
    "dark:text-[#7dd3fc] dark:decoration-[#38bdf8]/70 " +
    "dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.55)] " +
    "dark:hover:text-[#bae6fd] dark:hover:decoration-[#7dd3fc]";
  const chatSystemLinkCn =
    "inline-block max-w-full align-text-top break-all font-medium text-[#0284c7] underline underline-offset-[3px] transition-colors duration-150 [overflow-wrap:anywhere] decoration-[#0ea5e9]/65 " +
    "drop-shadow-[0_0_6px_rgba(14,165,233,0.45)] hover:text-[#0369a1] hover:decoration-[#38bdf8] " +
    "dark:text-[#7dd3fc] dark:decoration-[#38bdf8]/70 dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.45)] " +
    "dark:hover:text-[#bae6fd]";

  // For admin viewing reports: show client initials, otherwise show "S" for Support or user initials
  const otherInitials =
    conversation?.job_id === null
      ? currentUserProfile?.is_admin
        ? otherUser?.full_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?"
        : "S"
      : otherUser?.full_name
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase() || "?";

  const peekProfile: ChatParticipantProfile | null = otherUser
    ? {
        id: otherUser.id,
        full_name: otherUser.full_name,
        photo_url: otherUser.photo_url,
        city: otherUser.city,
        role: otherUser.role,
        bio: otherUser.bio ?? null,
        rating_avg: otherUser.rating_avg ?? null,
        rating_count: otherUser.rating_count ?? null,
        whatsapp_number_e164: otherUser.whatsapp_number_e164,
        telegram_username: otherUser.telegram_username,
        share_whatsapp: otherUser.share_whatsapp,
        share_telegram: otherUser.share_telegram,
        categories: otherUser.categories,
        is_verified: otherUser.is_verified ?? false,
      }
    : null;

  // Check if social messaging buttons should be shown
  const showWhatsApp =
    otherUser?.share_whatsapp && otherUser?.whatsapp_number_e164;
  const showTelegram =
    otherUser?.share_telegram && otherUser?.telegram_username;

  const chatAvatarStatus = useChatHeaderAvatarStatus(otherUser?.id);

  if (loading) {
    return (
      <div className={cn("flex bg-background overflow-hidden", hideBackButton ? "relative h-full min-h-0 w-full flex-col" : "fixed inset-0")}>
        {!hideBackButton && (
          <div className="fixed inset-y-0 left-0 w-full lg:w-[400px] border-r border-border/20 bg-transparent z-40 lg:relative">
            <div className="h-screen lg:h-full flex flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b border-border/20 bg-transparent p-4 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        )}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 min-w-0 flex-col bg-background",
            hideBackButton
              ? "pt-0"
              : "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.5rem)] lg:pt-0",
          )}
        >
          {/* Extra top bar while loading — omit when MessagesPage provides the fixed mobile header */}
          {!hideBackButton && (
            <div className="absolute left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-30 flex items-center justify-between border-b border-border/40 bg-background/80 px-2 py-2 pb-2 backdrop-blur-lg supports-[backdrop-filter]:bg-background/65 lg:relative lg:top-0 lg:z-10 lg:px-4 lg:pb-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-full relative" style={{ scrollBehavior: "smooth" }}>
            <div className="flex flex-col gap-6 py-6 pb-[250px]">
              <div className="w-full max-w-[80%] xl:max-w-[70%] mr-auto group">
                <div className="flex flex-col gap-1">
                  <div className="flex items-end gap-2 relative z-10">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-1 rounded-[18px] rounded-bl-[4px] bg-muted/60 px-3 py-2 relative min-w-[120px] max-w-full dark:bg-zinc-800">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full max-w-[80%] xl:max-w-[70%] ml-auto group flex justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <div className="flex items-end gap-2 relative z-10">
                     <div className="flex min-w-[140px] max-w-full flex-col gap-1 rounded-[18px] rounded-br-[4px] bg-primary/10 px-3 py-2 text-slate-800 dark:bg-primary/15 dark:text-slate-100 relative">
                       <Skeleton className="mb-1 h-4 w-48 bg-orange-200/70 dark:bg-primary/25" />
                       <Skeleton className="h-4 w-32 bg-orange-200/70 dark:bg-primary/25" />
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden",
        chatAreaBgCn,
        hideBackButton
          ? "relative h-full min-h-0 w-full flex-col"
          : "fixed inset-0",
      )}
    >
      {/* Side Panel - Step-by-Step Process (only show if not embedded) */}
      {!hideBackButton && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 w-full lg:w-[400px] border-r border-border/20 bg-transparent z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
            // On mobile: show when mobileView is 'steps', on desktop: always show
            mobileView === "steps" || showContactPanel
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="h-screen lg:h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border/20 bg-transparent p-4 rounded-t-2xl">
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
                    <HeaderBackChevron />
                  </Button>
                  <h2 className="text-lg font-semibold text-black dark:text-white">
                    {conversation?.job_id === null &&
                    currentUserProfile?.is_admin
                      ? "Issue Reports"
                      : ""}
                  </h2>
                </div>

                {/* Contact Info - Right side (mobile only) */}
                {conversation?.job_id !== null && otherUser && (
                  <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
                    <ChatParticipantProfilePeek
                      userId={otherUser.id}
                      profile={peekProfile}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={otherUser.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {otherInitials}
                        </AvatarFallback>
                      </Avatar>
                    </ChatParticipantProfilePeek>
                    <span className="text-sm font-medium leading-tight max-w-[100px] line-clamp-2">
                      {otherUser.full_name || "User"}
                    </span>
                    {showWhatsApp && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (otherUser?.whatsapp_number_e164) {
                            window.open(
                              getWhatsAppLink(otherUser.whatsapp_number_e164),
                              "_blank",
                            );
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
                            window.open(
                              getTelegramLink(otherUser.telegram_username),
                              "_blank",
                            );
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
            <div
              className="flex-1 overflow-y-auto p-6 pb-56 lg:pb-6 min-h-0"
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
                overscrollBehavior: "contain",
              }}
            >
              {conversation?.job_id === null && currentUserProfile?.is_admin ? (
                /* Report Conversations List */
                <div className="space-y-2">
                  {reportConversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No issue reports yet
                    </p>
                  ) : (
                    reportConversations.map((report) => {
                      const clientInitials =
                        report.client?.full_name
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
                              ? "border-primary bg-primary/10"
                              : "border-border bg-transparent hover:bg-primary/5",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage
                                src={report.client?.photo_url || undefined}
                              />
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
                                  <Badge
                                    variant="destructive"
                                    className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                                  >
                                    {report.unreadCount > 9
                                      ? "9+"
                                      : report.unreadCount}
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
                  <div className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-transparent shadow-none dark:border-white/10">
                    <div className="relative w-full min-h-[260px] h-[44vh] max-h-[520px] bg-muted sm:min-h-[300px] sm:h-[40vh] sm:max-h-[560px]">
                      {otherUser?.photo_url ? (
                        <img
                          src={otherUser.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[260px] w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5 sm:min-h-[300px]">
                          <span className="text-5xl font-bold text-primary sm:text-6xl">
                            {otherInitials}
                          </span>
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
                        <h3 className="text-2xl font-bold italic text-black dark:text-white">
                          {otherUser?.full_name || "User"}
                        </h3>

                        {otherUser?.role === "freelancer" &&
                          typeof otherUser.rating_avg === "number" && (
                            <div className="flex items-center justify-center gap-1 text-sm font-medium">
                              <div className="flex items-center text-slate-900 dark:text-white">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      "w-3.5 h-3.5",
                                      i < Math.round(otherUser.rating_avg || 0)
                                        ? "fill-slate-900 text-slate-900 dark:fill-white dark:text-white"
                                        : "fill-none text-slate-300 dark:text-slate-600",
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
                                    window.open(
                                      getWhatsAppLink(
                                        otherUser.whatsapp_number_e164,
                                      ),
                                      "_blank",
                                    );
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
                                    window.open(
                                      getTelegramLink(
                                        otherUser.telegram_username,
                                      ),
                                      "_blank",
                                    );
                                  }
                                }}
                              >
                                <TelegramIcon className="h-[18px] w-[18px] fill-white text-white group-hover:scale-105 transition-transform" />
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Categories Section */}
                        {otherUser?.categories &&
                          otherUser.categories.length > 0 && (
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
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-transparent px-3 py-1.5 font-bold tracking-tight text-slate-900 shadow-none dark:border-white/20 dark:text-white"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          JOB DETAILS
                        </Badge>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-transparent p-5 shadow-none dark:border-white/10">
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
                              <div className="flex gap-3 rounded-xl border border-border/50 bg-transparent p-3">
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
                                      ) : job.service_type ===
                                        "pickup_delivery" ? (
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
                                    <span className="truncate font-medium">
                                      {job.location_city}
                                    </span>
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
                                {job.service_type === "cleaning" && (
                                  <Sparkles className="w-5 h-5 text-primary" />
                                )}
                                {job.service_type === "cooking" && (
                                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                                )}
                                {job.service_type === "pickup_delivery" && (
                                  <Truck className="w-5 h-5 text-primary" />
                                )}
                                {job.service_type === "nanny" && (
                                  <Baby className="w-5 h-5 text-primary" />
                                )}
                                {(!job.service_type ||
                                  job.service_type === "other_help") && (
                                  <Briefcase className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-lg font-bold leading-tight truncate text-slate-900 dark:text-white">
                                  {formatJobTitle(job)}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-600 dark:text-white/70">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-sm font-medium">
                                    {job.location_city}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-3.5 border-t border-border/30">
                              {job.start_at && (
                                <div className="flex items-center gap-2.5">
                                  <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium leading-tight text-black dark:text-white">
                                    {formatDateTimeSimple(job.start_at)}
                                  </span>
                                </div>
                              )}

                              {job.time_duration && (
                                <div className="flex items-center gap-2.5">
                                  <Hourglass className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium capitalize text-black dark:text-white">
                                    {job.time_duration.replace(/_/g, " ")}
                                  </span>
                                </div>
                              )}

                              {job.care_frequency && (
                                <div className="flex items-center gap-2.5">
                                  <Repeat className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium capitalize text-black dark:text-white">
                                    {job.care_frequency.replace(/_/g, " ")}
                                  </span>
                                </div>
                              )}

                              {(Number(job.children_count) > 0 ||
                                job.service_type === "nanny") && (
                                <div className="flex items-center gap-2.5">
                                  <Baby className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-sm font-medium text-black dark:text-white">
                                    {Number(job.children_count) || 0}{" "}
                                    {job.children_age_group
                                      ? `(${formatAgeGroup(job.children_age_group as string)})`
                                      : ""}{" "}
                                    kids
                                  </span>
                                </div>
                              )}

                              {formatServiceDetails(
                                job.service_details,
                                job.service_type as string,
                              )}
                            </div>

                            {job.service_details?.custom && (
                              <div className="mt-2 flex w-full flex-col gap-1.5 rounded-xl border-none bg-primary px-3 py-2 shadow-sm">
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
      )}
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col transition-opacity duration-300",
          chatAreaBgCn,
          // On mobile: hide when 'steps' view is active
          !hideBackButton && mobileView === "steps" && "hidden lg:flex",
        )}
      >
        {/* Header — viewport-fixed on standalone /chat mobile; hidden when embedded in Messages (parent provides bar) */}
        {!hideBackButton && (
          <header
            className={cn(
              "fixed left-0 right-0 top-0 z-20 flex-shrink-0 bg-transparent px-4 pb-2 shadow-none",
              "pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
              "md:relative md:top-auto md:z-auto md:min-h-[4.25rem] md:px-5 md:pt-3 md:pb-2",
            )}
          >
            <div className="relative flex min-h-[4.25rem] items-end justify-center md:min-h-0 md:items-center md:justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileView("steps");
                  } else {
                    navigate("/messages");
                  }
                }}
                className={cn(
                  "absolute left-0 top-0 h-11 w-11 rounded-full lg:hidden",
                  glassBadgeClass,
                  glassIconButtonClass,
                )}
              >
                <HeaderBackChevron />
              </Button>

              <ChatFloatingProfileHeader
                userId={otherUser?.id}
                profile={peekProfile}
                displayName={
                  conversation?.job_id === null
                    ? currentUserProfile?.is_admin
                      ? otherUser?.full_name || "User"
                      : "Support"
                    : otherUser?.full_name || "User"
                }
                initials={otherInitials}
                photoUrl={otherUser?.photo_url}
                isVerified={Boolean(otherUser?.is_verified)}
                isLive24h={chatAvatarStatus.isLive24h}
                hasPostedRequest={chatAvatarStatus.hasPostedRequest}
                onNameClick={() =>
                  !hideBackButton && setShowContactPanel(!showContactPanel)
                }
              />

              {!hideBackButton && (showWhatsApp || showTelegram) ? (
                <div className="absolute bottom-2 right-0 flex gap-0.5 md:bottom-auto md:top-1/2 md:-translate-y-1/2">
                  {showWhatsApp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-full",
                        glassBadgeClass,
                        glassIconButtonClass,
                      )}
                      onClick={() => {
                        if (otherUser?.whatsapp_number_e164) {
                          window.open(
                            getWhatsAppLink(otherUser.whatsapp_number_e164),
                            "_blank",
                          );
                        }
                      }}
                      title="Open WhatsApp"
                    >
                      <WhatsAppIcon className="h-5 w-5 fill-[#25D366]" />
                    </Button>
                  )}
                  {showTelegram && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-full",
                        glassBadgeClass,
                        glassIconButtonClass,
                      )}
                      onClick={() => {
                        if (otherUser?.telegram_username) {
                          window.open(
                            getTelegramLink(otherUser.telegram_username),
                            "_blank",
                          );
                        }
                      }}
                      title="Open Telegram"
                    >
                      <TelegramIcon className="h-5 w-5 fill-[#0088cc]" />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </header>
        )}

        {/* Messages area */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scroll-auto",
            chatAreaBgCn,
            /**
             * When embedded inside `MessagesPage` (`hideBackButton`), the
             * parent renders a translucent floating chat header on both
             * viewports (a fixed bar on mobile, an absolute overlay on
             * desktop). The clearance for that header lives here as
             * *scrollable* top padding, so the first message sits below the
             * header initially and the bubbles slide UNDER it as the user
             * scrolls — which is what produces the glassy see-through blur.
             *
             *  - Mobile: safe-area-top + ~3.5rem to clear the fixed bar.
             *  - Desktop: 3.5rem to clear the absolute header.
             */
            hideBackButton
              ? "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+5.25rem)] md:pt-[5rem]"
              : "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+5.25rem)] md:pt-4",
            "px-3 md:p-4",
          )}
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
          ref={scrollRef}
          onScroll={handleMessagesScroll}
        >
          <div className="min-w-0 max-w-full">
            {/* Clearance for fixed composer + safe area (tight gap above input bar) */}
            <div className="min-w-0 max-w-full space-y-4 px-1 md:px-4 pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem+0.25rem)] md:pb-[calc(4.75rem+0.25rem)]">
              {job && hideBackButton && otherUser ? (
                <ChatJobContextStrip
                  job={job as JobSummaryRow}
                  participantName={otherUser.full_name || "Partner"}
                  jobHref={liveJobBanner?.href ?? null}
                />
              ) : null}
              {matchBannerActive && matchCategoryLabel && conversationId && (
                <MatchContextBanner
                  category={matchCategoryLabel}
                  location={matchLocationLabel || "—"}
                  time={matchTimeLabel || "—"}
                  onAccept={() => void handleMatchAccept()}
                  onDecline={() => void handleMatchDecline()}
                  busy={matchActionBusy}
                />
              )}
              {messages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const matchIntro = msg.body
                  ? parseMatchIntroBody(msg.body)
                  : null;

                if (
                  !matchIntro &&
                  !msg.attachment_url &&
                  isLikelySystemMessage(msg.body)
                ) {
                  return (
                    <div
                      key={msg.id}
                      className="space-y-4 chat-scroll-reveal chat-scroll-reveal--center"
                    >
                      {shouldShowDateHeader(index) && (
                        <div className="my-8 flex justify-center">
                          <span className="rounded-full bg-slate-100/80 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm backdrop-blur-[2px] dark:bg-slate-800/40 md:text-[10px]">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-center px-1 md:px-2">
                        <div className="max-w-md rounded-lg bg-muted/45 px-4 py-3 text-center text-lg leading-snug text-muted-foreground dark:bg-muted/25 border-none md:px-3 md:py-2 md:text-[13px] whitespace-pre-wrap">
                          {msg.body
                            ? linkifyMessageBody(msg.body, chatSystemLinkCn)
                            : null}
                          <span className="ml-2.5 inline text-[13px] font-medium tabular-nums opacity-80 md:ml-2 md:text-[11px]">
                            · {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                const linkPreviewUrls = msg.body
                  ? extractChatUrlsFromText(msg.body, 2)
                  : [];

                const isMedia = msg.attachment_url && (msg.attachment_type === "image" || msg.attachment_type === "video");

                if (isMedia && msg.attachment_url) {
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "min-w-0 max-w-full space-y-4 chat-scroll-reveal",
                        isOwn
                          ? "chat-scroll-reveal--sent"
                          : "chat-scroll-reveal--received",
                      )}
                    >
                      {shouldShowDateHeader(index) && (
                        <div className="my-8 flex justify-center">
                          <span className="rounded-full bg-slate-100/80 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm backdrop-blur-[2px] dark:bg-slate-800/40 md:text-[10px]">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={cn(
                          "flex w-full min-w-0 max-w-full items-end gap-2",
                          isOwn ? "flex-row-reverse" : "flex-row",
                        )}
                      >
                        {!isOwn && (
                          <Avatar className="hidden h-9 w-9 shrink-0 mb-1 md:flex md:h-8 md:w-8">
                            <AvatarImage
                              src={otherUser?.photo_url || undefined}
                            />
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary md:text-[10px]">
                              {otherInitials}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={cn(
                            "flex w-full min-w-0 max-w-[min(18.5rem,calc(100vw-5rem))] shrink flex-col md:max-w-[70%]",
                            "items-stretch",
                          )}
                        >
                          {/* Plain Media */}
                          <div
                            className={cn(
                              "flex w-full min-w-0 max-w-full",
                              isOwn ? "justify-end" : "justify-start",
                            )}
                          >
                            {msg.attachment_type === "image" ? (
                              <div
                                className="relative max-w-full cursor-pointer group/image transition-transform active:scale-[0.98]"
                                onClick={() => {
                                  setSelectedImage(msg);
                                  setIsImageModalOpen(true);
                                }}
                              >
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || "Attachment"}
                                  className={cn(
                                    "max-h-[380px] max-w-full object-cover shadow-md transition-shadow duration-300 md:max-h-[320px]",
                                    isOwn
                                      ? "rounded-2xl rounded-br-none"
                                      : "rounded-2xl rounded-bl-none",
                                  )}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/image:opacity-100 rounded-2xl bg-black/10">
                                  <ImageIcon className="w-8 h-8 text-white drop-shadow-md" />
                                </div>
                              </div>
                            ) : (
                              <video
                                src={msg.attachment_url}
                                controls
                                className="max-h-[380px] max-w-full rounded-2xl border-none object-cover shadow-sm md:max-h-[320px]"
                              />
                            )}
                          </div>

                          <div
                            className={cn(
                              "mt-2 flex min-w-0 w-full max-w-full",
                              isOwn ? "justify-end" : "justify-start",
                            )}
                          >
                            {linkPreviewUrls.length > 0 ? (
                              <div
                                className={cn(
                                  "flex w-full min-w-0 max-w-full flex-col gap-2",
                                  isOwn ? "items-end" : "items-start",
                                )}
                              >
                                {msg.body &&
                                  bodyHasNonPreviewText(
                                    msg.body,
                                    linkPreviewUrls,
                                  ) && (
                                    <div
                                      className={cn(
                                        "relative min-w-0 max-w-full w-fit px-3 py-2 shadow-sm transition-all duration-300 md:px-3 md:py-1.5",
                                        isOwn
                                          ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                          : chatReceivedBubbleCn,
                                      )}
                                    >
                                      <p
                                        className={cn(
                                          chatBubbleBodyTextCn,
                                          isOwn
                                            ? "text-white"
                                            : "text-foreground",
                                        )}
                                      >
                                        {linkifyMessageBody(
                                          msg.body,
                                          chatBubbleLinkCn,
                                          previewHrefOmitSet(linkPreviewUrls),
                                        )}
                                      </p>
                                    </div>
                                  )}
                                <div className="w-full min-w-0 max-w-full">
                                  <ChatLinkPreviewCards
                                    urls={linkPreviewUrls}
                                    variant={isOwn ? "sent" : "received"}
                                    embedded={false}
                                  />
                                </div>
                              </div>
                            ) : msg.body ? (
                              <div
                                className={cn(
                                  "relative min-w-0 max-w-full w-fit px-3 py-2 shadow-sm transition-all duration-300 md:px-3 md:py-1.5",
                                  isOwn
                                    ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                    : chatReceivedBubbleCn,
                                )}
                              >
                                <p
                                  className={cn(
                                    chatBubbleBodyTextCn,
                                    isOwn ? "text-white" : "text-foreground",
                                  )}
                                >
                                  {linkifyMessageBody(
                                    msg.body,
                                    chatBubbleLinkCn,
                                    previewHrefOmitSet(linkPreviewUrls),
                                  )}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          {/* Timestamp outside bubble */}
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground",
                              isOwn ? "justify-end" : "justify-start",
                            )}
                          >
                            <span>{formatTime(msg.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "min-w-0 max-w-full space-y-4 chat-scroll-reveal",
                      isOwn
                        ? "chat-scroll-reveal--sent"
                        : "chat-scroll-reveal--received",
                    )}
                  >
                    {shouldShowDateHeader(index) && (
                      <div className="my-8 flex justify-center">
                        <span className="rounded-full bg-slate-100/80 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-sm backdrop-blur-[2px] dark:bg-slate-800/40 md:text-[10px]">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex w-full min-w-0 max-w-full items-end gap-2",
                        isOwn ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      {!isOwn && (
                        <Avatar className="hidden h-9 w-9 shrink-0 mb-1 md:flex md:h-8 md:w-8">
                          <AvatarImage
                            src={otherUser?.photo_url || undefined}
                          />
                          <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary md:text-[10px]">
                            {otherInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={cn(
                          "flex w-full min-w-0 max-w-[min(18.5rem,calc(100vw-5rem))] shrink flex-col space-y-1 md:max-w-[70%]",
                          "items-stretch",
                        )}
                      >
                        <div
                          className={cn(
                            "flex min-w-0 w-full max-w-full",
                            isOwn ? "justify-end" : "justify-start",
                          )}
                        >
                        {linkPreviewUrls.length > 0 ? (
                          <div
                            className={cn(
                              "flex w-full min-w-0 max-w-full flex-col gap-2",
                              isOwn ? "items-end" : "items-start",
                            )}
                          >
                            {msg.attachment_url && (
                              <div
                                className={cn(
                                  "min-w-0 max-w-full w-fit px-2.5 py-2 shadow-sm transition-all duration-300",
                                  isOwn
                                    ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                    : chatReceivedBubbleCn,
                                )}
                              >
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg border border-dashed p-2 transition-colors md:p-1.5",
                                    isOwn
                                      ? "border-white/35 bg-black/15 text-white hover:bg-black/25"
                                      : "border-blue-500/25 bg-white/80 hover:bg-white dark:bg-zinc-700 dark:hover:bg-zinc-700/90",
                                  )}
                                >
                                  <File
                                    className={cn(
                                      "h-5 w-5 shrink-0 md:h-4 md:w-4",
                                      isOwn
                                        ? "text-white/90"
                                        : "text-blue-600 dark:text-blue-400",
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "max-w-[min(12rem,55vw)] truncate text-xl font-medium underline underline-offset-2 md:max-w-[150px] md:text-sm",
                                      isOwn
                                        ? "text-white decoration-white/35 hover:text-white"
                                        : "text-blue-600 decoration-blue-600/40 hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-400/45 dark:hover:text-blue-300",
                                    )}
                                  >
                                    {msg.attachment_name || "Download File"}
                                  </span>
                                </a>
                              </div>
                            )}

                            {msg.body && matchIntro ? (
                              <div
                                className={cn(
                                  "min-w-0 max-w-full w-fit px-3 py-3 shadow-sm transition-all duration-300",
                                  isOwn
                                    ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                    : chatReceivedBubbleCn,
                                )}
                              >
                                <div
                                  className={cn(
                                    "rounded-xl border px-2.5 py-2 text-xl md:px-2.5 md:py-1.5 md:text-sm",
                                    isOwn
                                      ? "border-white/20 bg-white/10 text-white"
                                      : "border-none bg-white/90 text-foreground dark:bg-zinc-700",
                                  )}
                                >
                                  <p className="text-xs font-bold uppercase tracking-wide opacity-80 md:text-[11px]">
                                    Match
                                  </p>
                                  <p className="mt-1 font-semibold">
                                    {matchIntro.category}
                                  </p>
                                  <p className="inline-block max-w-full text-lg opacity-90 md:text-xs">
                                    {matchIntro.location} · {matchIntro.time}
                                  </p>
                                </div>
                              </div>
                            ) : bodyHasNonPreviewText(
                                  msg.body || "",
                                  linkPreviewUrls,
                                ) &&
                                msg.body ? (
                              <div
                                className={cn(
                                  "relative min-w-0 max-w-full w-fit px-3 py-2 shadow-sm transition-all duration-300 md:px-3 md:py-1.5",
                                  isOwn
                                    ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                    : chatReceivedBubbleCn,
                                )}
                              >
                                <p
                                  className={cn(
                                    chatBubbleBodyTextCn,
                                    isOwn ? "text-white" : "text-foreground",
                                  )}
                                >
                                  {linkifyMessageBody(
                                    msg.body,
                                    chatBubbleLinkCn,
                                    previewHrefOmitSet(linkPreviewUrls),
                                  )}
                                </p>
                              </div>
                            ) : null}

                            <div className="w-full min-w-0 max-w-full">
                              <ChatLinkPreviewCards
                                urls={linkPreviewUrls}
                                variant={isOwn ? "sent" : "received"}
                                embedded={false}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "group relative min-w-0 max-w-full w-fit px-3 py-2 shadow-sm transition-all duration-300 md:px-3 md:py-1.5",
                              isOwn
                                ? "rounded-2xl rounded-br-none bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-md border-t border-white/10"
                                : chatReceivedBubbleCn,
                            )}
                          >
                            {/* Attachment Display */}
                            {msg.attachment_url && (
                              <div className="mb-2">
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 rounded-lg border border-dashed border-blue-500/25 bg-muted/50 p-2 transition-colors hover:bg-muted md:p-1.5"
                                >
                                  <File className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 md:h-4 md:w-4" />
                                  <span className="max-w-[min(12rem,55vw)] truncate text-xl font-medium text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-400/45 dark:hover:text-blue-300 md:max-w-[150px] md:text-sm">
                                    {msg.attachment_name || "Download File"}
                                  </span>
                                </a>
                              </div>
                            )}

                            {msg.body && matchIntro ? (
                              <div
                                className={cn(
                                  "rounded-xl border px-2.5 py-2 text-xl md:px-2.5 md:py-1.5 md:text-sm",
                                  isOwn
                                    ? "border-white/20 bg-white/10 text-white"
                                    : "bg-muted/50 text-foreground border-none dark:bg-zinc-700",
                                )}
                              >
                                <p className="text-xs font-bold uppercase tracking-wide opacity-80 md:text-[11px]">
                                  Match
                                </p>
                                <p className="mt-1 font-semibold">
                                  {matchIntro.category}
                                </p>
                                <p className="inline-block max-w-full text-lg opacity-90 md:text-xs">
                                  {matchIntro.location} · {matchIntro.time}
                                </p>
                              </div>
                            ) : msg.body ? (
                              <p
                                className={cn(
                                  chatBubbleBodyTextCn,
                                  isOwn ? "text-white" : "text-foreground",
                                )}
                              >
                                {linkifyMessageBody(
                                  msg.body,
                                  chatBubbleLinkCn,
                                  previewHrefOmitSet(linkPreviewUrls),
                                )}
                              </p>
                            ) : null}
                          </div>
                        )}
                        </div>
                        {/* Timestamp outside bubble */}
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground",
                            isOwn ? "justify-end" : "justify-start",
                          )}
                        >
                          <span>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {messages.length === 0 && (
                <div className="px-2 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Send className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {job
                      ? `Coordinate ${jobCategoryLabel(job)}${
                          job.location_city
                            ? ` in ${job.location_city}`
                            : ""
                        }.`
                      : "Start the conversation — say when you're available."}
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Messages appear instantly. Use a quick reply below to
                    respond in seconds.
                  </p>
                </div>
              )}
              <div
                ref={bottomAnchorRef}
                aria-hidden
                className="h-px w-full shrink-0"
              />
            </div>
          </div>
        </div>

        <ChatComposer
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          selectedFile={selectedFile}
          handleFileSelect={handleFileSelect}
          removeSelectedFile={removeSelectedFile}
          handleSend={handleSend}
          sending={sending}
          uploading={uploading}
          fileInputRef={fileInputRef}
          mobileComposerRef={mobileComposerRef}
          desktopComposerRef={desktopComposerRef}
          hideBackButton={hideBackButton}
          mobileView={mobileView}
        />
      </div>

      {/* Overlay for mobile contact panel */}
      {!hideBackButton && showContactPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setShowContactPanel(false)}
        />
      )}

      {/* Image Modal */}
      {selectedImage && selectedImage.attachment_url && (
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
                  ...freelancerUnavailableTimeSlots.map((date) => ({
                    date,
                    start_time: "00:00",
                    end_time: "23:59",
                  })),
                  ...scheduledJobs
                    .filter((j) => j.start_at)
                    .map((j) => ({
                      date: new Date(j.start_at!).toISOString().split("T")[0],
                      start_time: new Date(j.start_at!).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }),
                      end_time: "23:59",
                    })),
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
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowReviseModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!conversationId || !user || !reviseDate || !reviseTime)
                    return;
                  setRevisePending(true);
                  try {
                    const [hours, minutes] = reviseTime.split(":");
                    const reviseDateTime = new Date(reviseDate);
                    reviseDateTime.setHours(
                      parseInt(hours),
                      parseInt(minutes),
                      0,
                      0,
                    );
                    const reviseMessage = `🔄 Schedule Revision: ${reviseDateTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${reviseDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
                    const { error } = await supabase
                      .from("messages")
                      .insert({
                        conversation_id: conversationId,
                        sender_id: user.id,
                        body: reviseMessage,
                      });
                    if (error) throw error;
                    setShowReviseModal(false);
                    setRevisePending(false);
                    addToast({
                      title: "Revision request sent",
                      description:
                        "The client will review your proposed schedule.",
                      variant: "success",
                    });
                  } catch (err: any) {
                    console.error("Error sending revision request:", err);
                    addToast({
                      title: "Failed to send",
                      description:
                        err?.message || "Could not send revision request.",
                      variant: "error",
                    });
                    setRevisePending(false);
                  }
                }}
                disabled={revisePending || !reviseDate || !reviseTime}
              >
                {revisePending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4 mr-2" />
                )}
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
              <Select
                value={selectedCurrencyId}
                onValueChange={setSelectedCurrencyId}
              >
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
                  const rate =
                    parseFloat(paymentHourlyRateInput) ||
                    priceOffer ||
                    job?.offered_hourly_rate ||
                    0;
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
              <Label htmlFor="payment-hourly-rate-input">
                Hourly Rate (Can be changed)
              </Label>
              <Input
                id="payment-hourly-rate-input"
                type="number"
                step="0.01"
                min="0"
                placeholder={
                  priceOffer || job?.offered_hourly_rate
                    ? `Default: ${priceOffer || job?.offered_hourly_rate}`
                    : "Enter hourly rate"
                }
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

            {paymentHoursInput &&
              parseFloat(paymentHoursInput) > 0 &&
              paymentHourlyRateInput &&
              parseFloat(paymentHourlyRateInput) > 0 &&
              selectedCurrencyId && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hourly Rate:</span>
                    <span className="font-medium">
                      {currencies.find((c) => c.id === selectedCurrencyId)
                        ?.icon || "$"}
                      {paymentHourlyRate.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total:</span>
                    <span>
                      {currencies.find((c) => c.id === selectedCurrencyId)
                        ?.icon || "$"}
                      {paymentTotal.toFixed(2)}{" "}
                      {currencies.find((c) => c.id === selectedCurrencyId)
                        ?.iso || ""}
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
                  if (!conversationId || !user || !job || paymentPending)
                    return;
                  if (!selectedCurrencyId) {
                    addToast({
                      title: "Currency required",
                      description: "Please select a currency.",
                      variant: "error",
                    });
                    return;
                  }
                  const hours = parseFloat(paymentHoursInput) || 0;
                  if (isNaN(hours) || hours <= 0) {
                    addToast({
                      title: "Invalid hours",
                      description: "Please enter a valid number of hours.",
                      variant: "error",
                    });
                    return;
                  }
                  const rate =
                    parseFloat(paymentHourlyRateInput) ||
                    priceOffer ||
                    job.offered_hourly_rate ||
                    0;
                  if (isNaN(rate) || rate <= 0) {
                    addToast({
                      title: "Invalid hourly rate",
                      description: "Please enter a valid hourly rate.",
                      variant: "error",
                    });
                    return;
                  }
                  setPaymentPending(true);
                  try {
                    const vatRate = 0.18;
                    const subtotal = hours * rate;
                    const vat = subtotal * vatRate;
                    const total = subtotal + vat;
                    const { data: paymentData, error: paymentError } =
                      await supabase
                        .from("payments")
                        .insert({
                          job_id: job.id,
                          freelancer_id: conversation?.freelancer_id || user.id,
                          client_id: conversation?.client_id || "",
                          currency_id: selectedCurrencyId,
                          hours_worked: hours,
                          hourly_rate: rate,
                          subtotal: subtotal,
                          vat_rate: vatRate * 100,
                          vat_amount: vat,
                          total_amount: total,
                          status: "pending",
                        })
                        .select(`*, currency:currencies(id, name, iso, icon)`)
                        .single();
                    if (paymentError) throw paymentError;
                    if (paymentData) {
                      setPaymentHourlyRate(paymentData.hourly_rate);
                      setPaymentTotal(paymentData.total_amount);
                    }
                    await supabase
                      .from("job_requests")
                      .update({ stage: "Payment" })
                      .eq("id", job.id);
                    const currencyIcon =
                      currencies.find((c) => c.id === selectedCurrencyId)
                        ?.icon || "$";
                    const currencyIso =
                      currencies.find((c) => c.id === selectedCurrencyId)
                        ?.iso || "";
                    const paymentMessage = `💰 Payment Request: ${hours} hours × ${currencyIcon}${rate.toFixed(2)}/hr = ${currencyIcon}${total.toFixed(2)} ${currencyIso} (incl. VAT 18%)`;
                    await supabase
                      .from("messages")
                      .insert({
                        conversation_id: conversationId,
                        sender_id: user.id,
                        body: paymentMessage,
                      });
                    setShowPaymentModal(false);
                    setPaymentHoursInput("");
                    setPaymentHourlyRateInput("");
                    addToast({
                      title: "Payment request sent",
                      description: `Payment request of ${currencyIcon}${total.toFixed(2)} ${currencyIso} has been sent.`,
                    });
                  } catch (error) {
                    console.error("Error creating payment:", error);
                    addToast({
                      title: "Error",
                      description: "Failed to create payment request.",
                      variant: "error",
                    });
                  } finally {
                    setPaymentPending(false);
                  }
                }}
                disabled={
                  paymentPending ||
                  !paymentHoursInput ||
                  parseFloat(paymentHoursInput) <= 0
                }
              >
                {paymentPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Create Payment Request"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRevisePriceModal}
        onOpenChange={setShowRevisePriceModal}
      >
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
              <Input
                id="revise-price-input"
                type="number"
                placeholder="e.g., 25"
                value={priceOfferInput}
                onChange={(e) => setPriceOfferInput(e.target.value)}
                min="1"
                className="mt-2"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRevisePriceModal(false);
                  setPriceOfferInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (
                    !conversationId ||
                    !user ||
                    !priceOfferInput ||
                    !job ||
                    priceOfferPending
                  )
                    return;
                  const offerAmount = parseInt(priceOfferInput);
                  if (isNaN(offerAmount) || offerAmount < 1) {
                    addToast({
                      title: "Invalid amount",
                      description: "Please enter a valid hourly rate.",
                      variant: "error",
                    });
                    return;
                  }
                  setPriceOfferPending(true);
                  try {
                    await supabase
                      .from("job_requests")
                      .update({
                        offered_hourly_rate: offerAmount,
                        price_offer_status: "pending",
                        stage: "Price Offer",
                      })
                      .eq("id", job.id);
                    const priceMessage = `💰 Price Offer: $${offerAmount}/hour`;
                    await supabase
                      .from("messages")
                      .insert({
                        conversation_id: conversationId,
                        sender_id: user.id,
                        body: priceMessage,
                      });
                    setPriceOffer(offerAmount);
                    setPriceOfferInput("");
                    setShowRevisePriceModal(false);
                    addToast({
                      title: "Price offer sent",
                      description: `Your new offer of $${offerAmount}/hour has been sent.`,
                    });
                  } catch (error) {
                    console.error("Error sending price offer:", error);
                    addToast({
                      title: "Error",
                      description: "Failed to send price offer.",
                      variant: "error",
                    });
                  } finally {
                    setPriceOfferPending(false);
                  }
                }}
                disabled={priceOfferPending || !priceOfferInput}
              >
                {priceOfferPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Send New Offer"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
