import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ImageModal } from "@/components/ImageModal";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  ArrowLeft, 
  Loader2,
  Phone,
  MoreVertical,
  Check,
  CheckCheck,
  Paperclip,
  Image as ImageIcon,
  File,
  X,
  Clock,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { getJobStageBadge } from "@/lib/jobStages";

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
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<"steps" | "chat">("steps"); // Default to steps on mobile

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reportConversations, setReportConversations] = useState<Array<{ id: string; client: Profile; lastMessage?: Message; unreadCount: number }>>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<Message | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState<string>("09:00");
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleRequestSent, setScheduleRequestSent] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseDate, setReviseDate] = useState<Date | null>(null);
  const [reviseTime, setReviseTime] = useState<string>("09:00");
  const [revisePending, setRevisePending] = useState(false);
  const [priceOffer, setPriceOffer] = useState<number | null>(null);
  const [priceOfferStatus, setPriceOfferStatus] = useState<"pending" | "accepted" | "declined" | null>(null);
  const [priceOfferInput, setPriceOfferInput] = useState<string>("");
  const [priceOfferPending, setPriceOfferPending] = useState(false);
  const [showRevisePriceModal, setShowRevisePriceModal] = useState(false);
  const [jobStartStatus, setJobStartStatus] = useState<"pending" | "confirmed" | null>(null);
  const [jobStartPending, setJobStartPending] = useState(false);
  const [jobEndStatus, setJobEndStatus] = useState<"pending" | "confirmed" | null>(null);
  const [jobEndPending, setJobEndPending] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "accepted" | "declined" | "paid" | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentHours, setPaymentHours] = useState<number>(0);
  const [paymentHourlyRate, setPaymentHourlyRate] = useState<number>(0);
  const [paymentSubtotal, setPaymentSubtotal] = useState<number>(0);
  const [paymentVat, setPaymentVat] = useState<number>(0);
  const [paymentTotal, setPaymentTotal] = useState<number>(0);
  const [paymentCurrency, setPaymentCurrency] = useState<{ id: string; name: string; iso: string; icon: string } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHoursInput, setPaymentHoursInput] = useState<string>("");
  const [paymentHourlyRateInput, setPaymentHourlyRateInput] = useState<string>("");
  const [paymentPending, setPaymentPending] = useState(false);
  const [currencies, setCurrencies] = useState<Array<{ id: string; name: string; iso: string; icon: string }>>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("");
  const { addToast } = useToast();

  useEffect(() => {
    async function fetchCurrencies() {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("name");
      
      if (error) {
        console.error("Error fetching currencies:", error);
      } else if (data) {
        setCurrencies(data);
        // Set default currency to USD if available
        const usd = data.find(c => c.iso === "USD");
        if (usd) {
          setSelectedCurrencyId(usd.id);
        } else if (data.length > 0) {
          setSelectedCurrencyId(data[0].id);
        }
      }
    }
    
    fetchCurrencies();
  }, []);

  // Initialize hourly rate input when modal opens
  useEffect(() => {
    if (showPaymentModal) {
      const defaultRate = priceOffer || job?.offered_hourly_rate || 0;
      // Only initialize if input is empty (allows user to clear it completely)
      if (paymentHourlyRateInput === "" && defaultRate > 0) {
        setPaymentHourlyRateInput(defaultRate.toString());
        setPaymentHourlyRate(defaultRate);
      }
    } else {
      // Reset when modal closes
      setPaymentHourlyRateInput("");
      setPaymentHoursInput("");
    }
  }, [showPaymentModal]);

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
        .select("id, full_name, photo_url, city")
        .eq("id", otherId)
        .single();

      setOtherUser(profile);

      // Get job details (only if job_id is not null)
      let jobData = null;
      if (convo.job_id) {
        const { data } = await supabase
          .from("job_requests")
          .select("id, status, stage, care_type, children_count, children_age_group, location_city, start_at, created_at, offered_hourly_rate, price_offer_status, schedule_confirmed")
          .eq("id", convo.job_id)
          .single();

        jobData = data;
        setJob(jobData);
      } else {
        setJob(null);
      }
      
      // Set price offer state from job data
      if (jobData?.offered_hourly_rate) {
        setPriceOffer(jobData.offered_hourly_rate);
      }
      if (jobData?.price_offer_status) {
        setPriceOfferStatus(jobData.price_offer_status as "pending" | "accepted" | "declined");
      }
      
      // Always respect the database value for schedule_confirmed
      if (jobData?.schedule_confirmed) {
        setScheduleConfirmed(true);
      }

      // If admin viewing reports, fetch all report conversations
      if (currentUserProfile?.is_admin && convo.job_id === null) {
        await fetchReportConversations();
      }

      // Get messages - if otherUserId is provided, fetch from ALL conversations with that user
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

      // Check for schedule request or confirmation
      if (currentUserProfile?.role === "client") {
        // Client: Check if schedule request was sent
        const scheduleRequest = msgs?.find(msg => 
          msg.body?.includes("📅 Schedule Request") && 
          msg.sender_id === user.id
        );
        
        if (scheduleRequest) {
          setScheduleRequestSent(true);
          // Extract date from message or use job start_at
          if (jobData?.start_at) {
            setSelectedScheduleDate(new Date(jobData.start_at));
          } else {
            const dateMatch = scheduleRequest.body?.match(/Schedule Request: (.+)/);
            if (dateMatch) {
              try {
                const parsedDate = new Date(dateMatch[1]);
                if (!isNaN(parsedDate.getTime())) {
                  setSelectedScheduleDate(parsedDate);
                }
              } catch (e) {
                console.error("Error parsing schedule date:", e);
              }
            }
          }
          
          // Check if there's a confirmation message from freelancer
          const confirmationMsg = msgs?.find(msg => 
            (msg.body?.includes("Schedule confirmed") || 
             msg.body?.includes("✓")) &&
            msg.sender_id === otherId &&
            msg.created_at > scheduleRequest.created_at
          );
          
          if (confirmationMsg) {
            setScheduleConfirmed(true);
          }
        } else if (jobData?.start_at) {
          // If job has start_at but no request message, use that
          const scheduleDate = new Date(jobData.start_at);
          setSelectedScheduleDate(scheduleDate);
        }
      } else {
        // Freelancer: Check for schedule request from client
        const scheduleRequest = msgs?.find(msg => 
          msg.body?.includes("📅 Schedule Request") && 
          msg.sender_id === conversation?.client_id
        );
        
        if (scheduleRequest) {
          // Extract date from message or use job start_at
          if (jobData?.start_at) {
            setSelectedScheduleDate(new Date(jobData.start_at));
          }
          
          // Check if already confirmed - check for confirmation from either party
          const confirmationMsg = msgs?.find(msg => 
            (msg.body?.includes("Schedule confirmed") || 
             msg.body?.includes("✓ Schedule confirmed")) &&
            msg.created_at > scheduleRequest.created_at
          );
          
          // Also check if we're already in future steps - schedule must be confirmed
          const isInFutureStep = jobStartStatus === "confirmed" || jobEndStatus === "confirmed";
          
          if (confirmationMsg || jobData?.schedule_confirmed || isInFutureStep) {
            setScheduleConfirmed(true);
          }
        } else if (jobData?.start_at) {
          // If job has start_at but no request message, use that
          setSelectedScheduleDate(new Date(jobData.start_at));
          // If schedule_confirmed is true in DB, mark as confirmed
          if (jobData?.schedule_confirmed) {
            setScheduleConfirmed(true);
          }
        }
        
        // Always respect the database value if it's true
        if (jobData?.schedule_confirmed) {
          setScheduleConfirmed(true);
        }
      }
      
      // Check for job start messages
      const jobStartRequest = msgs?.find(msg => 
        msg.body?.includes("🚀 Job Started") &&
        msg.sender_id === (currentUserProfile?.role === "freelancer" ? user.id : otherId)
      );
      
      const jobStartConfirm = msgs?.find(msg => 
        (msg.body?.includes("Job started confirmed") || msg.body?.includes("✓ Job started confirmed")) &&
        msg.sender_id === (currentUserProfile?.role === "client" ? user.id : otherId) &&
        jobStartRequest &&
        msg.created_at > jobStartRequest.created_at
      );
      
      if (jobStartRequest && !jobStartConfirm) {
        setJobStartStatus("pending");
      } else if (jobStartConfirm) {
        setJobStartStatus("confirmed");
        // If job start is confirmed, schedule must be confirmed too
        setScheduleConfirmed(true);
      }
      
      // Check for job end messages
      const jobEndRequest = msgs?.find(msg => 
        msg.body?.includes("✅ Job Ended") &&
        msg.sender_id === (currentUserProfile?.role === "freelancer" ? user.id : otherId)
      );
      
      const jobEndConfirm = msgs?.find(msg => 
        (msg.body?.includes("Job ended confirmed") || msg.body?.includes("✓ Job ended confirmed")) &&
        msg.sender_id === (currentUserProfile?.role === "client" ? user.id : otherId) &&
        jobEndRequest &&
        msg.created_at > jobEndRequest.created_at
      );
      
      if (jobEndRequest && !jobEndConfirm) {
        setJobEndStatus("pending");
      } else if (jobEndConfirm) {
        setJobEndStatus("confirmed");
        // If job end is confirmed, schedule must be confirmed too
        setScheduleConfirmed(true);
      }
      
      // Final check: if we're in future steps, schedule must be confirmed
      // This ensures schedule is marked as confirmed even if detection above missed it
      if (jobStartStatus === "confirmed" || jobEndStatus === "confirmed") {
        setScheduleConfirmed(true);
      }

      // Check for existing payment (always check when job exists)
      // This ensures clients see payments even if job end isn't confirmed yet
      // Also check if job is completed to fetch paid payment
      if (job) {
        let existingPayment = null;
        
        // If job is completed, prefer paid payment, but still fetch latest if no paid exists
        if (job.stage === "Completed") {
          // First try to get paid payment
          const { data: paidPayment, error: paidError } = await supabase
            .from("payments")
            .select(`
              *,
              currency:currencies(id, name, iso, icon)
            `)
            .eq("job_id", job.id)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (paidError) {
            console.error("Error fetching paid payment:", paidError);
          }
          
          if (paidPayment) {
            console.log("Found paid payment for completed job:", paidPayment);
            existingPayment = paidPayment;
          } else {
            console.log("No paid payment found for completed job, fetching latest payment");
          }
        }
        
        // If we didn't find a paid payment (or job is not completed), fetch the latest payment (any status)
        if (!existingPayment) {
          const { data: latestPayment, error: paymentFetchError } = await supabase
            .from("payments")
            .select(`
              *,
              currency:currencies(id, name, iso, icon)
            `)
            .eq("job_id", job.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (paymentFetchError) {
            console.error("Error fetching payment:", paymentFetchError);
          } else if (latestPayment) {
            existingPayment = latestPayment;
          }
        }
        
        if (existingPayment) {
          console.log("Found existing payment:", existingPayment);
          setPaymentId(existingPayment.id);
          setPaymentStatus(existingPayment.status as "pending" | "accepted" | "declined" | "paid");
          setPaymentHours(existingPayment.hours_worked);
          setPaymentHourlyRate(existingPayment.hourly_rate);
          setPaymentSubtotal(existingPayment.subtotal);
          setPaymentVat(existingPayment.vat_amount);
          setPaymentTotal(existingPayment.total_amount);
          if (existingPayment.currency) {
            setPaymentCurrency(existingPayment.currency as { id: string; name: string; iso: string; icon: string });
          }
        } else {
          console.log("No payment found for job:", job.id, "stage:", job.stage);
        }
      }
      
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
            // Only add if it's not already in the list (avoid duplicates from optimistic updates)
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg];
            });
            
            // Mark as read if it's not from current user
            if (newMsg.sender_id !== user?.id) {
              markMessagesAsRead([newMsg.id]);
            }
            
            // Check if this is a schedule request message (client sent)
            if (newMsg.body?.includes("📅 Schedule Request") && newMsg.sender_id === user?.id && currentUserProfile?.role === "client") {
              setScheduleRequestSent(true);
            }
            
            // Check if this is a schedule confirmation message (freelancer confirmed)
            if (newMsg.body?.includes("Schedule confirmed") || 
                newMsg.body?.includes("✓ Schedule confirmed") ||
                (newMsg.body?.includes("✓") && newMsg.body?.includes("Schedule"))) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              if (newMsg.sender_id === otherId && currentUserProfile?.role === "client") {
                setScheduleConfirmed(true);
                // Also update job to mark schedule as confirmed
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
            
            // Check if this is a price offer message
            if (newMsg.body?.includes("💰 Price Offer")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId) {
                // Client received price offer
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                  setPriceOfferStatus("pending");
                }
              } else if (currentUserProfile?.role === "freelancer" && newMsg.sender_id === user?.id) {
                // Freelancer sent price offer
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                  setPriceOfferStatus("pending");
                }
              }
            }
            
            // Check if price offer was accepted
            if (newMsg.body?.includes("Price offer accepted")) {
              setPriceOfferStatus("accepted");
            }
            
            // Check if price offer was declined
            if (newMsg.body?.includes("Price offer declined")) {
              setPriceOfferStatus("declined");
            }
            
            // Check if payment request was sent
            if (newMsg.body?.includes("💰 Payment Request")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId && job) {
                // Client received payment request - fetch payment data with currency
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "pending")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  console.log("Client received payment request (multi-conv):", paymentData);
                  setPaymentId(paymentData.id);
                  setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
                  setPaymentHours(paymentData.hours_worked);
                  setPaymentHourlyRate(paymentData.hourly_rate);
                  setPaymentSubtotal(paymentData.subtotal);
                  setPaymentVat(paymentData.vat_amount);
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
                  }
                }
              }
            }

            // Check if payment was accepted
            if (newMsg.body?.includes("Payment accepted") || newMsg.body?.includes("✓ Payment accepted")) {
              setPaymentStatus("accepted");
              if (job) {
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "accepted")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
                  }
                }
              }
            }

            // Check if payment was declined
            if (newMsg.body?.includes("Payment declined") || newMsg.body?.includes("❌ Payment declined")) {
              setPaymentStatus("declined");
            }

            // Check if payment was completed
            if (newMsg.body?.includes("Payment completed") || newMsg.body?.includes("✓ Payment completed")) {
              setPaymentStatus("paid");
              if (job) {
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "paid")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
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
              // Fetch currency data
              const { data: currencyData } = await supabase
                .from("currencies")
                .select("*")
                .eq("id", payload.new.currency_id)
                .single();
              
              const paymentData = payload.new;
              setPaymentId(paymentData.id);
              setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
              setPaymentHours(paymentData.hours_worked);
              setPaymentHourlyRate(paymentData.hourly_rate);
              setPaymentSubtotal(paymentData.subtotal);
              setPaymentVat(paymentData.vat_amount);
              setPaymentTotal(paymentData.total_amount);
              if (currencyData) {
                setPaymentCurrency(currencyData);
              }
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
              console.log("Payment UPDATE detected (multi-conv):", payload.new);
              
              // Fetch currency data
              const { data: currencyData } = await supabase
                .from("currencies")
                .select("*")
                .eq("id", payload.new.currency_id)
                .single();
              
              const paymentData = payload.new;
              setPaymentId(paymentData.id);
              setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
              setPaymentHours(paymentData.hours_worked);
              setPaymentHourlyRate(paymentData.hourly_rate);
              setPaymentSubtotal(paymentData.subtotal);
              setPaymentVat(paymentData.vat_amount);
              setPaymentTotal(paymentData.total_amount);
              if (currencyData) {
                setPaymentCurrency(currencyData);
              }
              
              // If payment is marked as paid, update job stage to Completed
              if (paymentData.status === "paid") {
                console.log("Payment marked as paid, updating job stage to Completed");
                if (job.stage !== "Completed") {
                  const { error: jobError } = await supabase
                    .from("job_requests")
                    .update({ stage: "Completed" })
                    .eq("id", job.id);
                  
                  if (!jobError) {
                    setJob({ ...job, stage: "Completed" });
                  } else {
                    console.error("Error updating job stage to Completed:", jobError);
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
              
              // Fetch payment if it exists (if Completed, fetch paid payment)
              const paymentQuery = payload.new.stage === "Completed"
                ? supabase
                    .from("payments")
                    .select(`
                      *,
                      currency:currencies(id, name, iso, icon)
                    `)
                    .eq("job_id", job.id)
                    .eq("status", "paid")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                : supabase
                    .from("payments")
                    .select(`
                      *,
                      currency:currencies(id, name, iso, icon)
                    `)
                    .eq("job_id", job.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
              
              const { data: existingPayment } = await paymentQuery;
              
              if (existingPayment) {
                console.log("Payment found after job stage update (multi-conv):", existingPayment);
                setPaymentId(existingPayment.id);
                setPaymentStatus(existingPayment.status as "pending" | "accepted" | "declined" | "paid");
                setPaymentHours(existingPayment.hours_worked);
                setPaymentHourlyRate(existingPayment.hourly_rate);
                setPaymentSubtotal(existingPayment.subtotal);
                setPaymentVat(existingPayment.vat_amount);
                setPaymentTotal(existingPayment.total_amount);
                if (existingPayment.currency) {
                  setPaymentCurrency(existingPayment.currency as { id: string; name: string; iso: string; icon: string });
                }
              }
            }
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
            
            if (newMsg.body?.includes("📅 Schedule Request") && newMsg.sender_id === user?.id && currentUserProfile?.role === "client") {
              setScheduleRequestSent(true);
            }
            
            if (newMsg.body?.includes("Schedule confirmed") || 
                newMsg.body?.includes("✓ Schedule confirmed") ||
                (newMsg.body?.includes("✓") && newMsg.body?.includes("Schedule"))) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              if (newMsg.sender_id === otherId && currentUserProfile?.role === "client") {
                setScheduleConfirmed(true);
                // Also update job to mark schedule as confirmed
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
            
            // Check if this is a price offer message
            if (newMsg.body?.includes("💰 Price Offer")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId) {
                // Client received price offer
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                  setPriceOfferStatus("pending");
                }
              } else if (currentUserProfile?.role === "freelancer" && newMsg.sender_id === user?.id) {
                // Freelancer sent price offer
                const priceMatch = newMsg.body?.match(/Price Offer: \$?(\d+)/);
                if (priceMatch) {
                  setPriceOffer(parseInt(priceMatch[1]));
                  setPriceOfferStatus("pending");
                }
              }
            }
            
            // Check if price offer was accepted
            if (newMsg.body?.includes("Price offer accepted")) {
              setPriceOfferStatus("accepted");
            }
            
            // Check if price offer was declined
            if (newMsg.body?.includes("Price offer declined")) {
              setPriceOfferStatus("declined");
            }
            
            // Check if job started
            if (newMsg.body?.includes("🚀 Job Started")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId) {
                setJobStartStatus("pending");
              } else if (currentUserProfile?.role === "freelancer" && newMsg.sender_id === user?.id) {
                setJobStartStatus("pending");
              }
            }
            
            // Check if job start confirmed
            if (newMsg.body?.includes("Job started confirmed")) {
              setJobStartStatus("confirmed");
              // If job start is confirmed, schedule must be confirmed too
              setScheduleConfirmed(true);
            }
            
            // Check if schedule confirmed message
            if (newMsg.body?.includes("Schedule confirmed") || newMsg.body?.includes("✓ Schedule confirmed")) {
              setScheduleConfirmed(true);
            }
            
            // Check if job ended
            if (newMsg.body?.includes("✅ Job Ended")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId) {
                setJobEndStatus("pending");
              } else if (currentUserProfile?.role === "freelancer" && newMsg.sender_id === user?.id) {
                setJobEndStatus("pending");
              }
            }
            
            // Check if job end confirmed
            if (newMsg.body?.includes("Job ended confirmed")) {
              setJobEndStatus("confirmed");
              // If job end is confirmed, schedule must be confirmed too
              setScheduleConfirmed(true);
            }
            
            // Check if schedule confirmed message
            if (newMsg.body?.includes("Schedule confirmed") || newMsg.body?.includes("✓ Schedule confirmed")) {
              setScheduleConfirmed(true);
            }
            
            // Check if payment request was sent
            if (newMsg.body?.includes("💰 Payment Request")) {
              const otherId = conversation?.client_id === user?.id 
                ? conversation?.freelancer_id 
                : conversation?.client_id;
              
              if (currentUserProfile?.role === "client" && newMsg.sender_id === otherId && job) {
                // Client received payment request - fetch payment data with currency
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "pending")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  console.log("Client received payment request (single-conv):", paymentData);
                  setPaymentId(paymentData.id);
                  setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
                  setPaymentHours(paymentData.hours_worked);
                  setPaymentHourlyRate(paymentData.hourly_rate);
                  setPaymentSubtotal(paymentData.subtotal);
                  setPaymentVat(paymentData.vat_amount);
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
                  }
                }
              }
            }

            // Check if payment was accepted
            if (newMsg.body?.includes("Payment accepted") || newMsg.body?.includes("✓ Payment accepted")) {
              setPaymentStatus("accepted");
              if (job) {
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "accepted")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
                  }
                }
              }
            }

            // Check if payment was declined
            if (newMsg.body?.includes("Payment declined") || newMsg.body?.includes("❌ Payment declined")) {
              setPaymentStatus("declined");
            }

            // Check if payment was completed
            if (newMsg.body?.includes("Payment completed") || newMsg.body?.includes("✓ Payment completed")) {
              setPaymentStatus("paid");
              if (job) {
                const { data: paymentData } = await supabase
                  .from("payments")
                  .select(`
                    *,
                    currency:currencies(id, name, iso, icon)
                  `)
                  .eq("job_id", job.id)
                  .eq("status", "paid")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (paymentData) {
                  setPaymentTotal(paymentData.total_amount);
                  if (paymentData.currency) {
                    setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
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
              // Fetch currency data
              const { data: currencyData } = await supabase
                .from("currencies")
                .select("*")
                .eq("id", payload.new.currency_id)
                .single();
              
              const paymentData = payload.new;
              setPaymentId(paymentData.id);
              setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
              setPaymentHours(paymentData.hours_worked);
              setPaymentHourlyRate(paymentData.hourly_rate);
              setPaymentSubtotal(paymentData.subtotal);
              setPaymentVat(paymentData.vat_amount);
              setPaymentTotal(paymentData.total_amount);
              if (currencyData) {
                setPaymentCurrency(currencyData);
              }
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
              console.log("Payment UPDATE detected (single-conv):", payload.new);
              
              // Fetch currency data
              const { data: currencyData } = await supabase
                .from("currencies")
                .select("*")
                .eq("id", payload.new.currency_id)
                .single();
              
              const paymentData = payload.new;
              setPaymentId(paymentData.id);
              setPaymentStatus(paymentData.status as "pending" | "accepted" | "declined" | "paid");
              setPaymentHours(paymentData.hours_worked);
              setPaymentHourlyRate(paymentData.hourly_rate);
              setPaymentSubtotal(paymentData.subtotal);
              setPaymentVat(paymentData.vat_amount);
              setPaymentTotal(paymentData.total_amount);
              if (currencyData) {
                setPaymentCurrency(currencyData);
              }
              
              // If payment is marked as paid, update job stage to Completed
              if (paymentData.status === "paid") {
                console.log("Payment marked as paid, updating job stage to Completed (single-conv)");
                if (job.stage !== "Completed") {
                  const { error: jobError } = await supabase
                    .from("job_requests")
                    .update({ stage: "Completed" })
                    .eq("id", job.id);
                  
                  if (!jobError) {
                    setJob({ ...job, stage: "Completed" });
                  } else {
                    console.error("Error updating job stage to Completed:", jobError);
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
              console.log("Job stage changed to:", payload.new.stage, "(single-conv)");
              // Update job state
              setJob({ ...job, stage: payload.new.stage as string });
              
              // Fetch payment if it exists (if Completed, fetch paid payment)
              const paymentQuery = payload.new.stage === "Completed"
                ? supabase
                    .from("payments")
                    .select(`
                      *,
                      currency:currencies(id, name, iso, icon)
                    `)
                    .eq("job_id", job.id)
                    .eq("status", "paid")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                : supabase
                    .from("payments")
                    .select(`
                      *,
                      currency:currencies(id, name, iso, icon)
                    `)
                    .eq("job_id", job.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
              
              const { data: existingPayment } = await paymentQuery;
              
              if (existingPayment) {
                console.log("Payment found after job stage update (single-conv):", existingPayment);
                setPaymentId(existingPayment.id);
                setPaymentStatus(existingPayment.status as "pending" | "accepted" | "declined" | "paid");
                setPaymentHours(existingPayment.hours_worked);
                setPaymentHourlyRate(existingPayment.hourly_rate);
                setPaymentSubtotal(existingPayment.subtotal);
                setPaymentVat(existingPayment.vat_amount);
                setPaymentTotal(existingPayment.total_amount);
                if (existingPayment.currency) {
                  setPaymentCurrency(existingPayment.currency as { id: string; name: string; iso: string; icon: string });
                }
              } else {
                console.log("No payment found after job stage update to", payload.new.stage);
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
  }, [conversationId, user, navigate, propOtherUserId, currentUserProfile]);

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
            .select("id, full_name, photo_url, city")
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
      setTimeout(() => {
        scrollToBottom(false);
        isInitialLoadRef.current = false;
      }, 50);
    }
  }, [loading]); // Only trigger when loading changes from true to false

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
            "fixed inset-y-0 left-0 w-full lg:w-[400px] bg-card border-r z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
            // On mobile: show when mobileView is 'steps', on desktop: always show
            mobileView === "steps" || showContactPanel ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
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
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold">
                  {conversation?.job_id === null && currentUserProfile?.is_admin ? "Issue Reports" : "Job Steps"}
                </h2>
              </div>
              
              {/* Contact Info - Right side (mobile only) */}
              {conversation?.job_id !== null && otherUser && (
                <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={otherUser.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {otherInitials}
                    </AvatarFallback>
                  </Avatar>
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
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-6">
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
              /* Job Steps Content */
              <div className="space-y-6">
              {/* Step 0: Request */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                    priceOfferStatus === "accepted" || priceOfferStatus === "pending"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {priceOfferStatus === "accepted" || priceOfferStatus === "pending" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      "0"
                    )}
                  </div>
                  <h3 className="font-semibold">Request</h3>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      Job accepted
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 1: Price Offer */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                    priceOfferStatus === "accepted"
                      ? "bg-primary text-primary-foreground"
                      : priceOfferStatus === "pending"
                      ? "bg-amber-500 text-white"
                      : priceOfferStatus === "declined"
                      ? "bg-red-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {priceOfferStatus === "accepted" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      "1"
                    )}
                  </div>
                  <h3 className="font-semibold">Price Offer</h3>
                </div>

                {currentUserProfile?.role === "freelancer" ? (
                  // Freelancer view
                  (() => {
                    if (priceOfferStatus === "accepted") {
                      return (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="font-medium">
                              Price offer accepted: ${priceOffer}/hour
                            </span>
                          </div>
                        </div>
                      );
                    } else if (priceOfferStatus === "declined") {
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                              Your price offer was declined. You can revise and send a new offer.
                            </p>
                            <Button
                              onClick={() => setShowRevisePriceModal(true)}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              Revise Price Offer
                            </Button>
                          </div>
                          {priceOffer && (
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                Previous offer: ${priceOffer}/hour
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    } else if (priceOffer && priceOfferStatus === "pending") {
                      return (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            Waiting for client response on your offer: ${priceOffer}/hour
                          </p>
                        </div>
                      );
                    } else {
                      // No offer sent yet
                      return (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="price-input">Hourly Rate ($)</Label>
                            <Input
                              id="price-input"
                              type="number"
                              placeholder="e.g., 25"
                              value={priceOfferInput}
                              onChange={(e) => setPriceOfferInput(e.target.value)}
                              min="1"
                              className="mt-2"
                            />
                          </div>
                          <Button
                            onClick={async () => {
                              if (!conversationId || !user || !priceOfferInput || priceOfferPending) return;
                              
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
                                // Update job with price offer and set stage to "Price Offer"
                                const { error: jobError } = await supabase
                                  .from("job_requests")
                                  .update({
                                    offered_hourly_rate: offerAmount,
                                    price_offer_status: "pending",
                                    stage: "Price Offer",
                                  })
                                  .eq("id", job?.id);
                                
                                if (jobError) throw jobError;
                                
                                // Send message
                                const priceMessage = `💰 Price Offer: $${offerAmount}/hour`;
                                const { error: msgError } = await supabase
                                  .from("messages")
                                  .insert({
                                    conversation_id: conversationId,
                                    sender_id: user.id,
                                    body: priceMessage,
                                  });
                                
                                if (msgError) throw msgError;
                                
                                setPriceOffer(offerAmount);
                                setPriceOfferStatus("pending");
                                setPriceOfferInput("");
                                addToast({
                                  title: "Price offer sent",
                                  description: `Your offer of $${offerAmount}/hour has been sent.`,
                                });
                              } catch (error) {
                                console.error("Error sending price offer:", error);
                                addToast({
                                  title: "Error",
                                  description: "Failed to send price offer. Please try again.",
                                  variant: "error",
                                });
                              } finally {
                                setPriceOfferPending(false);
                              }
                            }}
                            disabled={priceOfferPending || !priceOfferInput}
                            className="w-full"
                          >
                            {priceOfferPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send Price Offer"
                            )}
                          </Button>
                        </div>
                      );
                    }
                  })()
                ) : (
                  // Client view
                  (() => {
                    if (priceOfferStatus === "accepted") {
                      return (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="font-medium">
                              Price offer accepted: ${priceOffer}/hour
                            </span>
                          </div>
                        </div>
                      );
                    } else if (priceOffer && priceOfferStatus === "pending") {
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm font-medium mb-2">
                              Price Offer: ${priceOffer}/hour
                            </p>
                            <div className="flex gap-2">
                              <Button
                                onClick={async () => {
                                  if (!conversationId || !user || !job) return;
                                  
                                  try {
                                    // Update job status - keep stage at "Price Offer" until schedule is confirmed
                                    const { error: jobError } = await supabase
                                      .from("job_requests")
                                      .update({
                                        price_offer_status: "accepted",
                                        status: "active",
                                        stage: "Price Offer",
                                      })
                                      .eq("id", job.id);
                                    
                                    if (jobError) throw jobError;
                                    
                                    // Send acceptance message
                                    const acceptMessage = `✓ Price offer accepted: $${priceOffer}/hour`;
                                    const { error: msgError } = await supabase
                                      .from("messages")
                                      .insert({
                                        conversation_id: conversationId,
                                        sender_id: user.id,
                                        body: acceptMessage,
                                      });
                                    
                                    if (msgError) throw msgError;
                                    
                                    setPriceOfferStatus("accepted");
                                    addToast({
                                      title: "Price offer accepted",
                                      description: "The job is now confirmed and scheduled.",
                                    });
                                  } catch (error) {
                                    console.error("Error accepting price offer:", error);
                                    addToast({
                                      title: "Error",
                                      description: "Failed to accept price offer. Please try again.",
                                      variant: "error",
                                    });
                                  }
                                }}
                                size="sm"
                                className="flex-1"
                              >
                                Accept
                              </Button>
                              <Button
                                onClick={async () => {
                                  if (!conversationId || !user || !job) return;
                                  
                                  try {
                                    // Update job status
                                    const { error: jobError } = await supabase
                                      .from("job_requests")
                                      .update({
                                        price_offer_status: "declined",
                                      })
                                      .eq("id", job.id);
                                    
                                    if (jobError) throw jobError;
                                    
                                    // Send decline message
                                    const declineMessage = `❌ Price offer declined`;
                                    const { error: msgError } = await supabase
                                      .from("messages")
                                      .insert({
                                        conversation_id: conversationId,
                                        sender_id: user.id,
                                        body: declineMessage,
                                      });
                                    
                                    if (msgError) throw msgError;
                                    
                                    setPriceOfferStatus("declined");
                                    addToast({
                                      title: "Price offer declined",
                                      description: "The freelancer can send a new offer.",
                                    });
                                  } catch (error) {
                                    console.error("Error declining price offer:", error);
                                    addToast({
                                      title: "Error",
                                      description: "Failed to decline price offer. Please try again.",
                                      variant: "error",
                                    });
                                  }
                                }}
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Waiting for freelancer to send a price offer...
                          </p>
                        </div>
                      );
                    }
                  })()
                )}
              </div>

              {/* Step 2: Schedule */}
              {priceOfferStatus === "accepted" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                      scheduleConfirmed 
                        ? "bg-primary text-primary-foreground" 
                        : schedulePending
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {scheduleConfirmed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "2"
                      )}
                    </div>
                    <h3 className="font-semibold">Schedule</h3>
                  </div>

                  {scheduleConfirmed ? (
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="font-medium">
                          Scheduled for {selectedScheduleDate?.toLocaleDateString("en-US", { 
                            weekday: "long", 
                            year: "numeric", 
                            month: "long", 
                            day: "numeric" 
                          })}
                          {selectedScheduleDate && (
                            <> at {selectedScheduleDate.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            })}</>
                          )}
                        </span>
                      </div>
                    </div>
                  ) : currentUserProfile?.role === "client" ? (
                  (() => {
                    // Check for revision request from freelancer
                    const reviseRequest = messages.find(msg => 
                      msg.body?.includes("🔄 Schedule Revision") && 
                      msg.sender_id === conversation?.freelancer_id
                    );
                    
                    if (reviseRequest) {
                      const reviseMatch = reviseRequest.body?.match(/Schedule Revision: (.+)/);
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <p className="text-sm font-medium mb-2">Revision Request:</p>
                            <p className="text-sm">{reviseMatch?.[1] || "New date/time proposed"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={async () => {
                                if (!conversationId || !user || !reviseRequest) return;
                                
                                try {
                                  // Extract date/time from revision message
                                  const reviseMatch = reviseRequest.body?.match(/Schedule Revision: (.+)/);
                                  const confirmMessage = `✓ Schedule confirmed: ${reviseMatch?.[1] || "Confirmed"}`;
                                  
                                  const { error } = await supabase
                                    .from("messages")
                                    .insert({
                                      conversation_id: conversationId,
                                      sender_id: user.id,
                                      body: confirmMessage,
                                    });

                                  if (error) throw error;

                                  // Update job start_at if we can parse the date/time
                                  if (job && reviseMatch?.[1]) {
                                    try {
                                      // Try to parse the date/time string
                                      const dateTimeStr = reviseMatch[1];
                                      // Format: "Friday, December 19, 2025 at 09:00 AM"
                                      const dateMatch = dateTimeStr.match(/(.+?) at (.+)/);
                                      if (dateMatch) {
                                        const datePart = dateMatch[1];
                                        const timePart = dateMatch[2];
                                        const parsedDate = new Date(datePart);
                                        const [time, period] = timePart.split(" ");
                                        const [hours, minutes] = time.split(":");
                                        let hour24 = parseInt(hours);
                                        if (period === "PM" && hour24 !== 12) hour24 += 12;
                                        if (period === "AM" && hour24 === 12) hour24 = 0;
                                        parsedDate.setHours(hour24, parseInt(minutes), 0, 0);
                                        
                                        const { error: jobError } = await supabase
                                          .from("job_requests")
                                          .update({ 
                                            start_at: parsedDate.toISOString(),
                                            schedule_confirmed: true,
                                            stage: "Schedule"
                                          })
                                          .eq("id", job.id);
                                        
                                        if (jobError) {
                                          console.error("Error updating job start_at:", jobError);
                                        } else {
                                          setScheduleConfirmed(true);
                                        }
                                      }
                                    } catch (e) {
                                      console.error("Error parsing revision date:", e);
                                    }
                                  } else {
                                    // If we can't parse the date, still mark as confirmed
                                    if (job) {
                                      const { error: jobError } = await supabase
                                        .from("job_requests")
                                        .update({ schedule_confirmed: true, stage: "Schedule" })
                                        .eq("id", job.id);
                                      
                                      if (!jobError) {
                                        setScheduleConfirmed(true);
                                      }
                                    }
                                  }
                                  setScheduleRequestSent(false);
                                  addToast({
                                    title: "Revision confirmed",
                                    description: "The schedule has been updated.",
                                    variant: "success",
                                    duration: 3000,
                                  });
                                } catch (err: any) {
                                  console.error("Error confirming revision:", err);
                                  addToast({
                                    title: "Failed to confirm",
                                    description: err?.message || "Could not confirm revision.",
                                    variant: "error",
                                    duration: 5000,
                                  });
                                }
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Confirm Revision
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        <SimpleCalendar
                          selectedDate={selectedScheduleDate}
                          onDateSelect={setSelectedScheduleDate}
                          minDate={new Date()}
                        />
                        {selectedScheduleDate && (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Time</label>
                              <Input
                                type="time"
                                value={selectedScheduleTime}
                                onChange={(e) => setSelectedScheduleTime(e.target.value)}
                                className="w-full"
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={async () => {
                                if (!conversationId || !user || !selectedScheduleDate || !selectedScheduleTime) return;
                                
                                setSchedulePending(true);
                                try {
                                  // Combine date and time
                                  const [hours, minutes] = selectedScheduleTime.split(":");
                                  const scheduleDateTime = new Date(selectedScheduleDate);
                                  scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                  
                                  // Send schedule request as a message
                                  const scheduleMessage = `📅 Schedule Request: ${scheduleDateTime.toLocaleDateString("en-US", { 
                                    weekday: "long", 
                                    year: "numeric", 
                                    month: "long", 
                                    day: "numeric" 
                                  })} at ${scheduleDateTime.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true
                                  })}`;
                                  
                                  const { error } = await supabase
                                    .from("messages")
                                    .insert({
                                      conversation_id: conversationId,
                                      sender_id: user.id,
                                      body: scheduleMessage,
                                    });

                                  if (error) throw error;

                                  // Update job start_at
                                  if (job) {
                                    const { error: jobError } = await supabase
                                      .from("job_requests")
                                      .update({ start_at: scheduleDateTime.toISOString() })
                                      .eq("id", job.id);

                                    if (jobError) {
                                      console.error("Error updating job start_at:", jobError);
                                    }
                                  }

                                  setSchedulePending(false);
                                  setScheduleRequestSent(true);
                                  addToast({
                                    title: "Schedule request sent",
                                    description: "The freelancer will receive your schedule request.",
                                    variant: "success",
                                    duration: 3000,
                                  });
                                } catch (err: any) {
                                  console.error("Error sending schedule request:", err);
                                  addToast({
                                    title: "Failed to send",
                                    description: err?.message || "Could not send schedule request.",
                                    variant: "error",
                                    duration: 5000,
                                  });
                                  setSchedulePending(false);
                                }
                              }}
                              disabled={schedulePending || scheduleRequestSent}
                            >
                              {schedulePending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Sending...
                                </>
                              ) : scheduleRequestSent ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Request sent
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Confirm Schedule
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  // Freelancer view - show pending schedule request
                  (() => {
                    // If schedule is already confirmed, show completed state
                    if (scheduleConfirmed) {
                      return (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="font-medium">
                              Schedule confirmed
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
                    const scheduleRequest = messages.find(msg => 
                      msg.body?.includes("📅 Schedule Request") && 
                      msg.sender_id === conversation?.client_id
                    );
                    
                    if (scheduleRequest) {
                      const dateMatch = scheduleRequest.body?.match(/Schedule Request: (.+)/);
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                            <p className="text-sm font-medium mb-2">Schedule Request:</p>
                            <p className="text-sm">{dateMatch?.[1] || "Date requested"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={async () => {
                                if (!conversationId || !user || !scheduleRequest || !job) return;
                                
                                try {
                                  const confirmMessage = `✓ Schedule confirmed: ${dateMatch?.[1] || "Confirmed"}`;
                                  
                                  // Send confirmation message first
                                  const { error } = await supabase
                                    .from("messages")
                                    .insert({
                                      conversation_id: conversationId,
                                      sender_id: user.id,
                                      body: confirmMessage,
                                    });

                                  if (error) throw error;

                                  // Parse date/time from schedule request message if start_at is not already set
                                  let scheduleDateTime: Date | null = null;
                                  if (!job.start_at && dateMatch?.[1]) {
                                    try {
                                      // Parse the date/time string from the message
                                      // Format: "Friday, December 19, 2025 at 09:00 AM"
                                      const dateTimeStr = dateMatch[1];
                                      const dateTimeMatch = dateTimeStr.match(/(.+?) at (.+)/);
                                      if (dateTimeMatch) {
                                        const datePart = dateTimeMatch[1];
                                        const timePart = dateTimeMatch[2];
                                        const parsedDate = new Date(datePart);
                                        const [time, period] = timePart.split(" ");
                                        const [hours, minutes] = time.split(":");
                                        let hour24 = parseInt(hours);
                                        if (period === "PM" && hour24 !== 12) hour24 += 12;
                                        if (period === "AM" && hour24 === 12) hour24 = 0;
                                        parsedDate.setHours(hour24, parseInt(minutes), 0, 0);
                                        scheduleDateTime = parsedDate;
                                      }
                                    } catch (e) {
                                      console.error("Error parsing schedule date from message:", e);
                                    }
                                  }

                                  // Always update schedule_confirmed, and update start_at if we have it
                                  const updateData: { schedule_confirmed: boolean; stage: string; start_at?: string } = {
                                    schedule_confirmed: true,
                                    stage: "Schedule"
                                  };
                                  
                                  if (scheduleDateTime) {
                                    updateData.start_at = scheduleDateTime.toISOString();
                                  } else if (job.start_at) {
                                    updateData.start_at = job.start_at;
                                  }

                                  const { error: jobError } = await supabase
                                    .from("job_requests")
                                    .update(updateData)
                                    .eq("id", job.id);

                                  if (jobError) {
                                    console.error("Error updating job schedule_confirmed:", jobError);
                                    throw jobError;
                                  }

                                  setScheduleConfirmed(true);
                                  addToast({
                                    title: "Schedule confirmed",
                                    description: "The client has been notified.",
                                    variant: "success",
                                    duration: 3000,
                                  });
                                } catch (err: any) {
                                  console.error("Error confirming schedule:", err);
                                  addToast({
                                    title: "Failed to confirm",
                                    description: err?.message || "Could not confirm schedule.",
                                    variant: "error",
                                    duration: 5000,
                                  });
                                }
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Confirm
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <p className="text-sm text-muted-foreground pl-10">
                        Waiting for schedule request...
                      </p>
                    );
                  })()
                  )}
                </div>
              )}

              {/* Step 3: Start Job */}
              {scheduleConfirmed && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                      jobStartStatus === "confirmed"
                        ? "bg-primary text-primary-foreground"
                        : jobStartStatus === "pending"
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {jobStartStatus === "confirmed" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "3"
                      )}
                    </div>
                    <h3 className="font-semibold">Start Job</h3>
                  </div>

                  {currentUserProfile?.role === "freelancer" ? (
                    // Freelancer view
                    (() => {
                      if (jobStartStatus === "confirmed") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Job started confirmed
                              </span>
                            </div>
                          </div>
                        );
                      } else if (jobStartStatus === "pending") {
                        return (
                          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              Waiting for client to confirm job start...
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <Button
                            onClick={async () => {
                              if (!conversationId || !user || jobStartPending) return;
                              
                              setJobStartPending(true);
                              try {
                                // Send job start message
                                const startMessage = `🚀 Job Started`;
                                const { error: msgError } = await supabase
                                  .from("messages")
                                  .insert({
                                    conversation_id: conversationId,
                                    sender_id: user.id,
                                    body: startMessage,
                                  });
                                
                                if (msgError) throw msgError;
                                
                                setJobStartStatus("pending");
                                addToast({
                                  title: "Job start requested",
                                  description: "Waiting for client confirmation.",
                                });
                              } catch (error) {
                                console.error("Error starting job:", error);
                                addToast({
                                  title: "Error",
                                  description: "Failed to start job. Please try again.",
                                  variant: "error",
                                });
                              } finally {
                                setJobStartPending(false);
                              }
                            }}
                            disabled={jobStartPending}
                            className="w-full"
                          >
                            {jobStartPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Starting...
                              </>
                            ) : (
                              "Start Job"
                            )}
                          </Button>
                        );
                      }
                    })()
                  ) : (
                    // Client view
                    (() => {
                      if (jobStartStatus === "confirmed") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Job started confirmed
                              </span>
                            </div>
                          </div>
                        );
                      } else if (jobStartStatus === "pending") {
                        return (
                          <div className="space-y-3">
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                              <p className="text-sm font-medium mb-3">
                                Freelancer has started the job. Please confirm.
                              </p>
                              <Button
                                onClick={async () => {
                                  if (!conversationId || !user || !job) return;
                                  
                                  try {
                                    // Update job stage to "Job in Progress"
                                    if (job) {
                                      const { error: jobError } = await supabase
                                        .from("job_requests")
                                        .update({
                                          status: "active",
                                          stage: "Job in Progress"
                                        })
                                        .eq("id", job.id);
                                      
                                      if (jobError) {
                                        console.error("Error updating job:", jobError);
                                      } else {
                                        // Update local job state
                                        setJob({ ...job, status: "active", stage: "Job in Progress" });
                                      }
                                    }

                                    // Send confirmation message
                                    const confirmMessage = `✓ Job started confirmed`;
                                    const { error: msgError } = await supabase
                                      .from("messages")
                                      .insert({
                                        conversation_id: conversationId,
                                        sender_id: user.id,
                                        body: confirmMessage,
                                      });
                                    
                                    if (msgError) throw msgError;
                                    
                                    setJobStartStatus("confirmed");
                                    addToast({
                                      title: "Job start confirmed",
                                      description: "The job has been started.",
                                    });
                                  } catch (error) {
                                    console.error("Error confirming job start:", error);
                                    addToast({
                                      title: "Error",
                                      description: "Failed to confirm job start. Please try again.",
                                      variant: "error",
                                    });
                                  }
                                }}
                                size="sm"
                                className="w-full"
                              >
                                Confirm Job Started
                              </Button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              Waiting for freelancer to start the job...
                            </p>
                          </div>
                        );
                      }
                    })()
                  )}
                </div>
              )}

              {/* Step 4: Job Ended */}
              {jobStartStatus === "confirmed" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                      jobEndStatus === "confirmed"
                        ? "bg-primary text-primary-foreground"
                        : jobEndStatus === "pending"
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {jobEndStatus === "confirmed" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "4"
                      )}
                    </div>
                    <h3 className="font-semibold">Job Ended</h3>
                  </div>

                  {currentUserProfile?.role === "freelancer" ? (
                    // Freelancer view
                    (() => {
                      if (jobEndStatus === "confirmed") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Job ended confirmed
                              </span>
                            </div>
                          </div>
                        );
                      } else if (jobEndStatus === "pending") {
                        return (
                          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              Waiting for client to confirm job end...
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <Button
                            onClick={async () => {
                              if (!conversationId || !user || !job || jobEndPending) return;
                              
                              setJobEndPending(true);
                              try {
                                // Update job stage to "Job Ended" immediately when freelancer ends job
                                const { error: jobError } = await supabase
                                  .from("job_requests")
                                  .update({
                                    stage: "Job Ended"
                                  })
                                  .eq("id", job.id);
                                
                                if (jobError) console.error("Error updating job stage:", jobError);
                                
                                // Update local job state
                                if (job) {
                                  setJob({ ...job, stage: "Job Ended" });
                                }
                                
                                // Send job end message
                                const endMessage = `✅ Job Ended`;
                                const { error: msgError } = await supabase
                                  .from("messages")
                                  .insert({
                                    conversation_id: conversationId,
                                    sender_id: user.id,
                                    body: endMessage,
                                  });
                                
                                if (msgError) throw msgError;
                                
                                setJobEndStatus("pending");
                                addToast({
                                  title: "Job end requested",
                                  description: "Waiting for client confirmation.",
                                });
                              } catch (error) {
                                console.error("Error ending job:", error);
                                addToast({
                                  title: "Error",
                                  description: "Failed to end job. Please try again.",
                                  variant: "error",
                                });
                              } finally {
                                setJobEndPending(false);
                              }
                            }}
                            disabled={jobEndPending}
                            className="w-full"
                          >
                            {jobEndPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Ending...
                              </>
                            ) : (
                              "Job Ended"
                            )}
                          </Button>
                        );
                      }
                    })()
                  ) : (
                    // Client view
                    (() => {
                      if (jobEndStatus === "confirmed") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Job ended confirmed
                              </span>
                            </div>
                          </div>
                        );
                      } else if (jobEndStatus === "pending") {
                        return (
                          <div className="space-y-3">
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                              <p className="text-sm font-medium mb-3">
                                Freelancer has ended the job. Please confirm.
                              </p>
                              <Button
                                onClick={async () => {
                                  if (!conversationId || !user || !job) return;
                                  
                                  try {
                                    // Update job stage to "Job Ended" (already set when freelancer ended, but ensure it's set)
                                    if (job) {
                                      const { error: jobError } = await supabase
                                        .from("job_requests")
                                        .update({
                                          stage: "Job Ended"
                                        })
                                        .eq("id", job.id);
                                      
                                      if (jobError) {
                                        console.error("Error updating job:", jobError);
                                      } else {
                                        // Update local job state
                                        setJob({ ...job, stage: "Job Ended" });
                                      }
                                    }

                                    // Send confirmation message
                                    const confirmMessage = `✓ Job ended confirmed`;
                                    const { error: msgError } = await supabase
                                      .from("messages")
                                      .insert({
                                        conversation_id: conversationId,
                                        sender_id: user.id,
                                        body: confirmMessage,
                                      });
                                    
                                    if (msgError) throw msgError;
                                    
                                    setJobEndStatus("confirmed");
                                    addToast({
                                      title: "Job end confirmed",
                                      description: "The job has been completed.",
                                    });
                                  } catch (error) {
                                    console.error("Error confirming job end:", error);
                                    addToast({
                                      title: "Error",
                                      description: "Failed to confirm job end. Please try again.",
                                      variant: "error",
                                    });
                                  }
                                }}
                                size="sm"
                                className="w-full"
                              >
                                Confirm Job Ended
                              </Button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              Waiting for freelancer to end the job...
                            </p>
                          </div>
                        );
                      }
                    })()
                  )}
                </div>
              )}

              {/* Step 5: Payment */}
              {/* Show payment step if: job ended, job stage is Payment/Completed, or payment exists */}
              {(jobEndStatus === "confirmed" || job?.stage === "Payment" || job?.stage === "Completed" || paymentStatus !== null || paymentId !== null) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                      paymentStatus === "paid"
                        ? "bg-primary text-primary-foreground"
                        : paymentStatus === "accepted"
                        ? "bg-green-500 text-white"
                        : paymentStatus === "pending"
                        ? "bg-amber-500 text-white"
                        : paymentStatus === "declined"
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {paymentStatus === "paid" || paymentStatus === "accepted" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "5"
                      )}
                    </div>
                    <h3 className="font-semibold">Payment</h3>
                  </div>

                  {currentUserProfile?.role === "freelancer" ? (
                    // Freelancer view
                    (() => {
                      if (paymentStatus === "paid") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Payment received: {paymentCurrency?.icon || "$"}{paymentTotal?.toFixed(2) || '0.00'} {paymentCurrency?.iso || ""}
                              </span>
                            </div>
                          </div>
                        );
                      } else if (paymentStatus === "accepted") {
                        return (
                          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Payment accepted. Waiting for client to complete payment...
                            </p>
                          </div>
                        );
                      } else if (paymentStatus === "pending") {
                        return (
                          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              Payment request sent. Waiting for client to accept...
                            </p>
                          </div>
                        );
                      } else if (paymentStatus === "declined") {
                        return (
                          <div className="space-y-3">
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                              <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                                Client declined the payment request. You can create a new payment request.
                              </p>
                              <Button
                                onClick={() => setShowPaymentModal(true)}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                Create New Payment Request
                              </Button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <Button
                            onClick={() => setShowPaymentModal(true)}
                            className="w-full"
                          >
                            Create Payment Request
                          </Button>
                        );
                      }
                    })()
                  ) : (
                    // Client view
                    (() => {
                      if (paymentStatus === "paid") {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Payment completed: {paymentCurrency?.icon || "$"}{paymentTotal?.toFixed(2) || '0.00'} {paymentCurrency?.iso || ""}
                              </span>
                            </div>
                          </div>
                        );
                      } else if (paymentStatus === "pending") {
                        return (
                          <div className="space-y-3">
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                              <p className="text-sm font-medium mb-2">
                                Payment Request: {paymentCurrency?.icon || "$"}{paymentTotal?.toFixed(2) || '0.00'} {paymentCurrency?.iso || ""}
                              </p>
                              <p className="text-xs text-muted-foreground mb-3">
                                {paymentHours > 0 && (
                                  <>
                                    Hours: {paymentHours || 0} × {paymentCurrency?.icon || "$"}{paymentHourlyRate || 0}/hr
                                    <br />
                                  </>
                                )}
                                Subtotal: {paymentCurrency?.icon || "$"}{paymentSubtotal?.toFixed(2) || '0.00'}
                                <br />
                                VAT (18%): {paymentCurrency?.icon || "$"}{paymentVat?.toFixed(2) || '0.00'}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    if (!conversationId || !user || !paymentId) return;
                                    
                                    try {
                                      // Update payment status to accepted
                                      const { error: paymentError } = await supabase
                                        .from("payments")
                                        .update({
                                          status: "accepted"
                                        })
                                        .eq("id", paymentId);
                                      
                                      if (paymentError) throw paymentError;
                                      
                                    // Send acceptance message
                                    const acceptMessage = `✓ Payment accepted: ${paymentCurrency?.icon || "$"}${paymentTotal?.toFixed(2) || '0.00'} ${paymentCurrency?.iso || ""}`;
                                      const { error: msgError } = await supabase
                                        .from("messages")
                                        .insert({
                                          conversation_id: conversationId,
                                          sender_id: user.id,
                                          body: acceptMessage,
                                        });
                                      
                                      if (msgError) throw msgError;
                                      
                                      setPaymentStatus("accepted");
                                      addToast({
                                        title: "Payment accepted",
                                        description: "Payment has been accepted. You can complete it in the Payments tab.",
                                      });
                                      
                                      // Navigate to payments tab
                                      setTimeout(() => {
                                        navigate("/payments");
                                      }, 1000);
                                    } catch (error) {
                                      console.error("Error accepting payment:", error);
                                      addToast({
                                        title: "Error",
                                        description: "Failed to accept payment. Please try again.",
                                        variant: "error",
                                      });
                                    }
                                }}
                                size="sm"
                                className="flex-1"
                              >
                                Accept
                              </Button>
                              <Button
                                onClick={async () => {
                                  if (!conversationId || !user || !paymentId) return;
                                  
                                  try {
                                    // Update payment status to declined
                                    const { error: paymentError } = await supabase
                                      .from("payments")
                                      .update({
                                        status: "declined"
                                      })
                                      .eq("id", paymentId);
                                    
                                    if (paymentError) throw paymentError;
                                    
                                    // Send decline message
                                    const declineMessage = `❌ Payment declined`;
                                    const { error: msgError } = await supabase
                                      .from("messages")
                                      .insert({
                                        conversation_id: conversationId,
                                        sender_id: user.id,
                                        body: declineMessage,
                                      });
                                    
                                    if (msgError) throw msgError;
                                    
                                    setPaymentStatus("declined");
                                    addToast({
                                      title: "Payment declined",
                                      description: "The freelancer can create a new payment request.",
                                    });
                                  } catch (error) {
                                    console.error("Error declining payment:", error);
                                    addToast({
                                      title: "Error",
                                      description: "Failed to decline payment. Please try again.",
                                      variant: "error",
                                    });
                                  }
                                }}
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                          </div>
                        );
                      } else if (paymentStatus === "declined") {
                        return (
                          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                            <p className="text-sm text-red-600 dark:text-red-400">
                              Payment declined. Waiting for freelancer to create a new payment request...
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              Waiting for freelancer to create payment request...
                            </p>
                          </div>
                        );
                      }
                    })()
                  )}
                </div>
              )}

            </div>
              )}
          </ScrollArea>

          {/* Mobile Chat Button - at bottom of job steps panel */}
          {!hideBackButton && (
            <div className="lg:hidden border-t p-4 bg-card flex-shrink-0">
              <Button
                onClick={() => setMobileView("chat")}
                className="w-full"
                size="lg"
              >
                <Send className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
            </div>
          )}

          {/* Modals - Outside ScrollArea */}
          {/* Revise Schedule Modal */}
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
                          if (!conversationId || !user || !reviseDate || !reviseTime) return;
                          
                          setRevisePending(true);
                          try {
                            // Combine date and time
                            const [hours, minutes] = reviseTime.split(":");
                            const reviseDateTime = new Date(reviseDate);
                            reviseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            
                            // Send revise request as a message
                            const reviseMessage = `🔄 Schedule Revision: ${reviseDateTime.toLocaleDateString("en-US", { 
                              weekday: "long", 
                              year: "numeric", 
                              month: "long", 
                              day: "numeric" 
                            })} at ${reviseDateTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            })}`;
                            
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
                              description: "The client will review your proposed schedule.",
                              variant: "success",
                              duration: 3000,
                            });
                          } catch (err: any) {
                            console.error("Error sending revision request:", err);
                            addToast({
                              title: "Failed to send",
                              description: err?.message || "Could not send revision request.",
                              variant: "error",
                              duration: 5000,
                            });
                            setRevisePending(false);
                          }
                        }}
                        disabled={revisePending || !reviseDate || !reviseTime}
                      >
                        {revisePending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Send Revision
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Payment Modal */}
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
                          
                          setPaymentHours(hours);
                          setPaymentHourlyRate(rate);
                          setPaymentSubtotal(subtotal);
                          setPaymentVat(vat);
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
                          // Allow empty string for full deletion
                          setPaymentHourlyRateInput(e.target.value);
                          const rate = parseFloat(e.target.value) || 0;
                          const hours = parseFloat(paymentHoursInput) || 0;
                          const subtotal = hours * rate;
                          const vatRate = 0.18;
                          const vat = subtotal * vatRate;
                          const total = subtotal + vat;
                          
                          setPaymentHourlyRate(rate);
                          setPaymentSubtotal(subtotal);
                          setPaymentVat(vat);
                          setPaymentTotal(total);
                        }}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        You can change the hourly rate from the original offer
                      </p>
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
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Hours:</span>
                          <span className="font-medium">{parseFloat(paymentHoursInput) || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">
                            {currencies.find(c => c.id === selectedCurrencyId)?.icon || "$"}
                            {paymentSubtotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT (18%):</span>
                          <span className="font-medium">
                            {currencies.find(c => c.id === selectedCurrencyId)?.icon || "$"}
                            {paymentVat.toFixed(2)}
                          </span>
                        </div>
                        <Separator />
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
                          
                          // Validate currency
                          if (!selectedCurrencyId) {
                            addToast({
                              title: "Currency required",
                              description: "Please select a currency.",
                              variant: "error",
                            });
                            return;
                          }

                          // Validate hours
                          const hours = parseFloat(paymentHoursInput) || 0;
                          if (isNaN(hours) || hours <= 0) {
                            addToast({
                              title: "Invalid hours",
                              description: "Please enter a valid number of hours.",
                              variant: "error",
                            });
                            return;
                          }

                          // Validate hourly rate
                          const rate = parseFloat(paymentHourlyRateInput) || priceOffer || job.offered_hourly_rate || 0;
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

                            // Create payment record
                            const { data: paymentData, error: paymentError } = await supabase
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
                                status: "pending"
                              })
                              .select(`
                                *,
                                currency:currencies(id, name, iso, icon)
                              `)
                              .single();
                            
                            if (paymentError) throw paymentError;

                            // Update local state immediately
                            if (paymentData) {
                              setPaymentId(paymentData.id);
                              setPaymentStatus("pending");
                              setPaymentHours(paymentData.hours_worked);
                              setPaymentHourlyRate(paymentData.hourly_rate);
                              setPaymentSubtotal(paymentData.subtotal);
                              setPaymentVat(paymentData.vat_amount);
                              setPaymentTotal(paymentData.total_amount);
                              if (paymentData.currency) {
                                setPaymentCurrency(paymentData.currency as { id: string; name: string; iso: string; icon: string });
                              }
                            }

                            // Update job stage to Payment
                            const { error: jobError } = await supabase
                              .from("job_requests")
                              .update({
                                stage: "Payment"
                              })
                              .eq("id", job.id);
                            
                            if (jobError) console.error("Error updating job stage:", jobError);
                            
                            // Send payment request message
                            const currencyIcon = currencies.find(c => c.id === selectedCurrencyId)?.icon || "$";
                            const currencyIso = currencies.find(c => c.id === selectedCurrencyId)?.iso || "";
                            const paymentMessage = `💰 Payment Request: ${hours} hours × ${currencyIcon}${rate.toFixed(2)}/hr = ${currencyIcon}${total.toFixed(2)} ${currencyIso} (incl. VAT 18%)`;
                            const { error: msgError } = await supabase
                              .from("messages")
                              .insert({
                                conversation_id: conversationId,
                                sender_id: user.id,
                                body: paymentMessage,
                              });
                            
                            if (msgError) throw msgError;
                            
                            setShowPaymentModal(false);
                            setPaymentHoursInput("");
                            setPaymentHourlyRateInput("");
                            addToast({
                              title: "Payment request sent",
                              description: `Payment request of ${currencyIcon}${total.toFixed(2)} ${currencyIso} has been sent to the client.`,
                            });
                          } catch (error) {
                            console.error("Error creating payment:", error);
                            addToast({
                              title: "Error",
                              description: "Failed to create payment request. Please try again.",
                              variant: "error",
                            });
                          } finally {
                            setPaymentPending(false);
                          }
                        }}
                        disabled={paymentPending || !paymentHoursInput || parseFloat(paymentHoursInput) <= 0}
                      >
                        {paymentPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Payment Request"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Revise Price Modal */}
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
                          if (!conversationId || !user || !priceOfferInput || !job || priceOfferPending) return;
                          
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
                            // Update job with new price offer and set stage to "Price Offer"
                            const { error: jobError } = await supabase
                              .from("job_requests")
                              .update({
                                offered_hourly_rate: offerAmount,
                                price_offer_status: "pending",
                                stage: "Price Offer",
                              })
                              .eq("id", job.id);
                            
                            if (jobError) throw jobError;
                            
                            // Send message
                            const priceMessage = `💰 Price Offer: $${offerAmount}/hour`;
                            const { error: msgError } = await supabase
                              .from("messages")
                              .insert({
                                conversation_id: conversationId,
                                sender_id: user.id,
                                body: priceMessage,
                              });
                            
                            if (msgError) throw msgError;
                            
                            setPriceOffer(offerAmount);
                            setPriceOfferStatus("pending");
                            setPriceOfferInput("");
                            setShowRevisePriceModal(false);
                            addToast({
                              title: "Price offer sent",
                              description: `Your new offer of $${offerAmount}/hour has been sent.`,
                            });
                          } catch (error) {
                            console.error("Error sending revised price offer:", error);
                            addToast({
                              title: "Error",
                              description: "Failed to send price offer. Please try again.",
                              variant: "error",
                            });
                          } finally {
                            setPriceOfferPending(false);
                          }
                        }}
                        disabled={priceOfferPending || !priceOfferInput}
                      >
                        {priceOfferPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send New Offer"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
          
          {/* Mobile Chat Button - at bottom of job steps panel */}
          {!hideBackButton && (
            <div className="lg:hidden border-t p-4 bg-card">
              <Button
                onClick={() => setMobileView("chat")}
                className="w-full"
                size="lg"
              >
                <Send className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Overlay for mobile */}
      {!hideBackButton && showContactPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setShowContactPanel(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        // Hide chat on mobile when viewing steps
        !hideBackButton && mobileView === "steps" && "hidden lg:flex"
      )}>
        {/* Header - Fixed */}
        <header className="flex-shrink-0 border-b bg-card px-4 py-3 md:relative fixed top-0 left-0 right-0 z-20 md:z-auto">
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
                className="lg:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}

            <Avatar className="w-10 h-10 cursor-pointer" onClick={() => !hideBackButton && setShowContactPanel(!showContactPanel)}>
              <AvatarImage src={otherUser?.photo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {otherInitials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !hideBackButton && setShowContactPanel(!showContactPanel)}>
              <h2 className="font-semibold truncate">
                {conversation?.job_id === null 
                  ? (currentUserProfile?.is_admin ? (otherUser?.full_name || "User") : "Support")
                  : (otherUser?.full_name || "User")}
              </h2>
              {!hideBackButton && (
                <p className="text-xs text-muted-foreground">
                  Tap for contact info
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
                >
                  <Phone className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowContactPanel(!showContactPanel)}
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Job Summary Header - Fixed */}
        {job && (
          <div className="flex-shrink-0 border-b bg-muted/30 px-4 py-2 md:relative fixed top-[57px] left-0 right-0 z-20 md:z-auto md:top-auto">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {`Nanny – ${job.children_count} kid${job.children_count > 1 ? "s" : ""} (${job.children_age_group})`}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.stage ? (
                      <Badge variant={getJobStageBadge(job.stage).variant} className="text-xs">
                        {getJobStageBadge(job.stage).label}
                      </Badge>
                    ) : (
                      <Badge variant={job.status === "locked" ? "default" : job.status === "active" ? "default" : "outline"} className="text-xs">
                        {job.status === "locked" ? "Scheduled" : job.status === "active" ? "In progress" : job.status}
                      </Badge>
                    )}
                  </div>
                </div>
                {job.start_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(job.start_at).toLocaleDateString()} {new Date(job.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages - Scrollable Area */}
        <div className={cn(
          "flex-1 min-h-0 flex flex-col bg-gradient-to-b from-muted/20 to-background",
          "md:pt-0",
          job ? "pt-[106px]" : "pt-[57px]"
        )}>
          {/* Mobile: Use native scrolling */}
          <div 
            ref={mobileScrollRef}
            className="md:hidden flex-1 overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="p-4 space-y-4 pb-36">
              {messages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const receiptStatus = isOwn ? getReadReceiptStatus(msg) : null;

                return (
                  <div key={msg.id} className={isOwn ? "animate-message-sent" : "animate-slide-in-left"}>
                    {/* Date Header */}
                    {shouldShowDateHeader(index) && (
                      <div className="flex justify-center my-6">
                        <span className="text-xs text-muted-foreground bg-muted/80 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        "flex gap-2 max-w-[70%]",
                        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      {!isOwn && (
                        <Avatar className="w-8 h-8 flex-shrink-0 mt-auto">
                          <AvatarImage src={otherUser?.photo_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {otherInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                        {/* Image Attachment - Display outside bubble */}
                        {msg.attachment_url && msg.attachment_type === "image" && (
                          <div className="mb-2">
                            <img
                              src={msg.attachment_url}
                              alt={msg.attachment_name || "Attachment"}
                              className="max-w-[300px] rounded-lg cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedImage(msg);
                                setIsImageModalOpen(true);
                              }}
                            />
                          </div>
                        )}

                        {/* Message Body or File Attachment - Inside bubble */}
                        {(msg.body || (msg.attachment_url && msg.attachment_type !== "image")) && (
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 max-w-full break-words",
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-card border text-foreground"
                            )}
                          >
                            {/* File Attachment */}
                            {msg.attachment_url && msg.attachment_type !== "image" && (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm hover:underline"
                              >
                                <File className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{msg.attachment_name || "Attachment"}</span>
                                {msg.attachment_size && (
                                  <span className="text-xs opacity-70">
                                    {(msg.attachment_size / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </a>
                            )}

                            {/* Message Text */}
                            {msg.body && (
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            )}
                          </div>
                        )}

                        {/* Timestamp and Read Receipt */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(msg.created_at)}
                          </span>
                          {isOwn && receiptStatus && (
                            <ReadReceipt status={receiptStatus} />
                          )}
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
          
          {/* Desktop: Use ScrollArea */}
          <ScrollArea className="hidden md:flex flex-1" ref={scrollRef}>
            <div className="p-6 lg:p-8 space-y-6 pb-4">
              {messages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const receiptStatus = isOwn ? getReadReceiptStatus(msg) : null;

                return (
                  <div key={msg.id} className={isOwn ? "animate-message-sent" : "animate-slide-in-left"}>
                    {/* Date Header */}
                    {shouldShowDateHeader(index) && (
                      <div className="flex justify-center my-6">
                        <span className="text-xs text-muted-foreground bg-muted/80 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        "flex gap-2 md:gap-3 max-w-[70%] md:max-w-[65%] lg:max-w-[60%]",
                        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      {!isOwn && (
                        <Avatar className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 flex-shrink-0 mt-auto">
                          <AvatarImage src={otherUser?.photo_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm lg:text-base">
                            {otherInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                        {/* Image Attachment - Display outside bubble */}
                        {msg.attachment_url && msg.attachment_type === "image" && (
                          <div className="mb-2 md:mb-3">
                            <img
                              src={msg.attachment_url}
                              alt={msg.attachment_name || "Attachment"}
                              className="max-w-[300px] md:max-w-[500px] lg:max-w-[600px] rounded-lg cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedImage(msg);
                                setIsImageModalOpen(true);
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Message Body or File Attachment - Inside bubble */}
                        {(msg.body || (msg.attachment_url && msg.attachment_type !== "image")) && (
                          <div
                            className={cn(
                              "rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3 shadow-sm",
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-card border border-border rounded-bl-md"
                            )}
                          >
                            {/* File Attachment */}
                            {msg.attachment_url && msg.attachment_type !== "image" && (
                              <div className="mb-2 md:mb-3">
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg hover:bg-black/10 transition-colors",
                                    isOwn ? "bg-black/10" : "bg-muted"
                                  )}
                                >
                                  <File className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm md:text-base font-medium truncate">
                                      {msg.attachment_name || "Attachment"}
                                    </p>
                                    {msg.attachment_size && (
                                      <p className="text-xs md:text-sm opacity-75">
                                        {(msg.attachment_size / 1024).toFixed(1)} KB
                                      </p>
                                    )}
                                  </div>
                                </a>
                              </div>
                            )}
                            {/* Message Body */}
                            {msg.body && (
                              <p className="text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed">
                                {msg.body}
                              </p>
                            )}
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 md:gap-2 mt-1 md:mt-2 px-1",
                            isOwn ? "flex-row-reverse" : ""
                          )}
                        >
                          <span className="text-[10px] md:text-xs text-muted-foreground">
                            {formatTime(msg.created_at)}
                          </span>
                          {isOwn && receiptStatus && (
                            <ReadReceipt status={receiptStatus} />
                          )}
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
          </ScrollArea>
        </div>

        {/* Input - Fixed at Bottom */}
        <div className="flex-shrink-0 border-t bg-card px-4 py-3 md:sticky md:bottom-0 fixed bottom-[72px] left-0 right-0 z-10 md:pb-0 md:relative md:bottom-auto md:left-auto md:right-auto">
          {/* Selected File Preview */}
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
              {getFileType(selectedFile.name) === "image" ? (
                <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <File className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={removeSelectedFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <form
            onSubmit={handleSend}
            className="flex gap-2 max-w-4xl mx-auto items-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input
              ref={inputRef}
              placeholder={selectedFile ? "Add a message (optional)..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 rounded-full border-2 focus:border-primary h-10 text-sm"
              disabled={sending || uploading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0"
              disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            >
              {(sending || uploading) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

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
    </div>
  );
}
