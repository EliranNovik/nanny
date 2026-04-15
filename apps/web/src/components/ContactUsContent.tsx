import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Clock,
  HeartHandshake,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  CheckCircle2,
} from "lucide-react";

const SUPPORT_EMAIL = "support@mamalama.com";

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "account", label: "Account & profile" },
  { value: "helpers", label: "Finding helpers or offering help" },
  { value: "feedback", label: "Feedback & ideas" },
  { value: "safety", label: "Safety or concern" },
  { value: "other", label: "Something else" },
] as const;

function Blob({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl opacity-35",
        className,
      )}
      aria-hidden
    />
  );
}

export function ContactUsContent() {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Please add your name.";
    const em = email.trim();
    if (!em) next.email = "We need an email so we can reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      next.email = "That doesn’t look like a valid email.";
    if (!message.trim())
      next.message = "Tell us a little about how we can help.";
    else if (message.trim().length < 15)
      next.message =
        "A few more words help us understand (at least 15 characters).";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? topic;
    const subject = `[MamaLama] ${topicLabel}`;
    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      phone.trim() ? `Phone: ${phone.trim()}` : null,
      `Topic: ${topicLabel}`,
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      window.location.href = mailto;
      setSubmitted(true);
      addToast({
        title: "Thank you for reaching out",
        description:
          "If your email app opened, just send the message. You can also email us directly if you prefer.",
        variant: "success",
      });
    } catch {
      addToast({
        title: "Couldn’t open your email app",
        description: `Write to us at ${SUPPORT_EMAIL} — we read every message.`,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="relative w-full max-w-2xl mx-auto">
        <Blob className="-right-16 -top-16 h-56 w-56 bg-gradient-to-br from-orange-400 to-rose-500" />
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-10 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
          </div>
          <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            We’ve got your note
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Thanks for trusting us with your question. If your mail program
            opened, send the draft and our team will get back to you as soon as
            we can—usually within one business day.
          </p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Nothing opened? Email us directly at{" "}
            <a
              className="font-bold text-primary underline-offset-4 hover:underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-8 rounded-xl"
            onClick={() => {
              setSubmitted(false);
              setMessage("");
              setFieldErrors({});
            }}
          >
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 pb-4">
      {/* Intro */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/60 p-8 shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/40 md:p-10">
        <Blob className="-right-20 -top-20 h-64 w-64 bg-gradient-to-br from-orange-400/80 to-rose-500/60" />
        <Blob className="-bottom-16 -left-12 h-48 w-48 bg-gradient-to-tr from-primary/40 to-amber-300/50" />
        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300">
            <MessageCircle className="h-3.5 w-3.5" />
            We’re here for you
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
            Contact us
          </h1>
          <p className="text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            Questions, worries, or a rough day with the app—tell us. MamaLama is
            built for real families and helpers; we read what you send and
            answer with care, not scripts.
          </p>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        {/* Care strip + contact info */}
        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-gradient-to-br from-orange-50/90 to-white p-6 shadow-md dark:border-white/10 dark:from-orange-950/30 dark:to-slate-950/50">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  People first
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  We don’t route you through endless bots. Share what’s going
                  on—we’ll take it seriously and reply in plain language.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-card/80 p-6 shadow-sm dark:border-white/10">
            <div className="flex items-start gap-3">
              <Mail
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Email
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-border/60 pt-4">
              <Clock
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Typical reply
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Within 1 business day, often sooner
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Form */}
        <div className="rounded-[1.75rem] border-2 border-slate-200/90 bg-white/90 p-6 shadow-xl dark:border-white/10 dark:bg-slate-950/70 md:p-8">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Send us a message
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The form below opens your email app with your message ready to
            send—we never store it on a server from this page.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="contact-name">Your name</Label>
                <Input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  placeholder="How we should address you"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name)
                      setFieldErrors((f) => ({ ...f, name: "" }));
                  }}
                  className={cn(
                    fieldErrors.name &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p className="text-xs font-medium text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email)
                      setFieldErrors((f) => ({ ...f, email: "" }));
                  }}
                  className={cn(
                    fieldErrors.email &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="text-xs font-medium text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">
                Phone{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+972 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-topic">Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger
                  id="contact-topic"
                  className="h-11 rounded-lg border-2"
                >
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">Your message</Label>
              <Textarea
                id="contact-message"
                name="message"
                rows={6}
                placeholder="What’s on your mind? The more context you share, the better we can help."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (fieldErrors.message)
                    setFieldErrors((f) => ({ ...f, message: "" }));
                }}
                className={cn(
                  "min-h-[140px] rounded-lg border-2 border-input bg-background px-4 py-3 text-sm transition-colors focus-visible:ring-2",
                  fieldErrors.message &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                aria-invalid={!!fieldErrors.message}
              />
              {fieldErrors.message && (
                <p className="text-xs font-medium text-destructive">
                  {fieldErrors.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-base font-bold shadow-lg hover:from-orange-600 hover:to-red-700 sm:w-auto sm:min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Continue to email
                </>
              )}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Submitting opens your default email app with your message
              addressed to {SUPPORT_EMAIL}. You can edit before sending. Prefer
              not to use email? You can still reach us at the address above from
              any device.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
