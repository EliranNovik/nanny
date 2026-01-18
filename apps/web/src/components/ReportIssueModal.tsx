import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useReportIssue } from "@/context/ReportIssueContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Check, CheckCheck, Paperclip, X, Image as ImageIcon, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageModal } from "@/components/ImageModal";

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

export function ReportIssueModal() {
  const { isOpen, closeReportModal } = useReportIssue();
  const { user } = useAuth();
  const { addToast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<Message | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Fetch or create conversation when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchOrCreateConversation();
    } else {
      // Reset state when modal closes
      setConversationId(null);
      setMessages([]);
      setNewMessage("");
      setSelectedFile(null);
    }
  }, [isOpen, user]);

  // Fetch messages when conversation is available
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    if (conversationId) {
      fetchMessages();
      channel = subscribeToMessages();
    }
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchOrCreateConversation() {
    if (!user) return;

    setLoading(true);
    try {
      // Find admin user
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_admin", true)
        .limit(1)
        .maybeSingle();

      if (!adminProfile) {
        addToast({
          title: "Admin not found",
          description: "Unable to connect to support. Please try again later.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      // Check if admin conversation already exists
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", user.id)
        .eq("freelancer_id", adminProfile.id)
        .is("job_id", null)
        .maybeSingle();

      let convId: string;

      if (existingConvo) {
        convId = existingConvo.id;
      } else {
        // Create admin conversation
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({
            client_id: user.id,
            freelancer_id: adminProfile.id,
            job_id: null,
          })
          .select("id")
          .single();

        if (convoError || !newConvo) {
          throw convoError || new Error("Failed to create conversation");
        }

        convId = newConvo.id;
      }

      setConversationId(convId);
    } catch (error: any) {
      console.error("Error fetching/creating conversation:", error);
      addToast({
        title: "Error",
        description: error?.message || "Failed to connect to support.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages() {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages(data || []);

    // Mark messages as read
    if (data && data.length > 0) {
      const unreadMessages = data.filter(
        (msg) => msg.sender_id !== user?.id && !msg.read_at
      );
      if (unreadMessages.length > 0) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString(), read_by: user?.id })
          .in("id", unreadMessages.map((m) => m.id));
      }
    }
  }

  function subscribeToMessages() {
    if (!conversationId) return null;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // Mark as read if it's not from current user
          if (newMessage.sender_id !== user?.id) {
            supabase
              .from("messages")
              .update({ read_at: new Date().toISOString(), read_by: user?.id })
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return channel;
  }

  function getFileType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return "image";
    }
    return "file";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !conversationId) return;
    if (!newMessage.trim() && !selectedFile) return;

    setSending(true);
    const body = newMessage.trim();
    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;
    let attachmentSize: number | null = null;

    // Upload file if selected
    if (selectedFile) {
      setUploading(true);
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `conversations/${conversationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(filePath);

        attachmentUrl = urlData.publicUrl;
        attachmentType = getFileType(selectedFile.name);
        attachmentName = selectedFile.name;
        attachmentSize = selectedFile.size;
      } catch (error: any) {
        console.error("Error uploading file:", error);
        addToast({
          title: "Upload failed",
          description: error?.message || "Failed to upload file.",
          variant: "error",
        });
        setUploading(false);
        setSending(false);
        return;
      }
      setUploading(false);
    }

    const tempId = `temp-${Date.now()}`;
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
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(body || "");
      setSelectedFile(selectedFile);
      console.error("Error sending message:", error);
      addToast({
        title: "Failed to send",
        description: error.message || "Please try again.",
        variant: "error",
      });
    } else if (data) {
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? data : msg)));
    }

    setSending(false);
    inputRef.current?.focus();
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  return (
    <Dialog open={isOpen} onOpenChange={closeReportModal}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Support Chat</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const receiptStatus = isOwn ? getReadReceiptStatus(msg) : null;

                  return (
                    <div key={msg.id} className="flex flex-col">
                      <div
                        className={cn(
                          "flex gap-2 max-w-[75%]",
                          isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        {!isOwn && (
                          <Avatar className="w-8 h-8 flex-shrink-0 mt-auto">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              S
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                          {/* Image Attachment */}
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

                          {/* Message Body or File Attachment */}
                          {(msg.body || (msg.attachment_url && msg.attachment_type !== "image")) && (
                            <div
                              className={cn(
                                "rounded-xl px-4 py-2 shadow-sm",
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-card border border-border rounded-bl-md"
                              )}
                            >
                              {/* File Attachment */}
                              {msg.attachment_url && msg.attachment_type !== "image" && (
                                <div className="mb-2">
                                  <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center gap-2 p-2 rounded-lg hover:bg-black/10 transition-colors",
                                      isOwn ? "bg-black/10" : "bg-muted"
                                    )}
                                  >
                                    <File className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {msg.attachment_name || "Attachment"}
                                      </p>
                                      {msg.attachment_size && (
                                        <p className="text-xs opacity-75">
                                          {(msg.attachment_size / 1024).toFixed(1)} KB
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                </div>
                              )}
                              {/* Message Body */}
                              {msg.body && (
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                  {msg.body}
                                </p>
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 mt-1 px-1",
                              isOwn ? "flex-row-reverse" : ""
                            )}
                          >
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

                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <Send className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No messages yet. Start a conversation with support!</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex-shrink-0 border-t bg-card px-4 py-3">
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

              <form onSubmit={handleSend} className="flex gap-2 items-center">
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
          </>
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
      </DialogContent>
    </Dialog>
  );
}
