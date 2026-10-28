import { useState, useEffect, FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { apiPublicPost } from "@/lib/api";

const SUPPORT_EMAIL = "info@tebnu.com";

const TOPIC_VALUES = [
  "general",
  "account",
  "helpers",
  "feedback",
  "safety",
  "other",
] as const;

type TopicValue = (typeof TOPIC_VALUES)[number];

const TOPIC_API_LABELS: Record<TopicValue, string> = {
  general: "General question",
  account: "Account & profile",
  helpers: "Finding helpers or offering help",
  feedback: "Feedback & ideas",
  safety: "Safety or concern",
  other: "Something else",
};

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
  const { t } = useTranslation();
  const { addToast } = useToast();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (hash !== "contact-form" && hash !== "form") return;
    const card = document.getElementById("contact-form");
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
    const nameField = document.getElementById("contact-name");
    const timer = window.setTimeout(() => nameField?.focus(), 400);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("contactPage.errors.name");
    const em = email.trim();
    if (!em) next.email = t("contactPage.errors.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      next.email = t("contactPage.errors.emailInvalid");
    if (!message.trim()) next.message = t("contactPage.errors.messageRequired");
    else if (message.trim().length < 15)
      next.message = t("contactPage.errors.messageShort");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const topicValue = TOPIC_VALUES.includes(topic as TopicValue)
      ? (topic as TopicValue)
      : "other";
    const topicLabel = TOPIC_API_LABELS[topicValue];

    try {
      await apiPublicPost("/api/contact", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        topic,
        topicLabel,
        message: message.trim(),
      });
      setSubmitted(true);
      addToast({
        title: t("contactPage.toastSuccessTitle"),
        description: t("contactPage.toastSuccessBody"),
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: t("contactPage.toastErrorTitle"),
        description:
          err instanceof Error
            ? t("contactPage.toastErrorWithMessage", {
                message: err.message,
                email: SUPPORT_EMAIL,
              })
            : t("contactPage.toastErrorFallback", { email: SUPPORT_EMAIL }),
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
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-10 text-center shadow-xl backdrop-blur dark:border-transparent dark:bg-slate-950/60">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
          </div>
          <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t("contactPage.successTitle")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {t("contactPage.successBody")}
          </p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {t("contactPage.successEmailLead")}{" "}
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
            {t("contactPage.sendAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 pb-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/60 p-8 shadow-lg backdrop-blur-sm dark:border-transparent dark:bg-slate-950/40 md:p-10">
        <Blob className="-right-20 -top-20 h-64 w-64 bg-gradient-to-br from-orange-400/80 to-rose-500/60" />
        <Blob className="-bottom-16 -left-12 h-48 w-48 bg-gradient-to-tr from-primary/40 to-amber-300/50" />
        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-orange-700 dark:border-transparent dark:bg-orange-500/15 dark:text-orange-300">
            <MessageCircle className="h-3.5 w-3.5" />
            {t("contactPage.badge")}
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
            {t("contactPage.title")}
          </h1>
          <p className="text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            {t("contactPage.intro")}
          </p>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-gradient-to-br from-orange-50/90 to-white p-6 shadow-md dark:border-transparent dark:from-orange-950/30 dark:to-slate-950/50">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {t("contactPage.peopleFirstTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("contactPage.peopleFirstBody")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-card/80 p-6 shadow-sm dark:border-transparent">
            <div className="flex items-start gap-3">
              <Mail
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("contactPage.emailLabel")}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-border/60 pt-4 dark:border-transparent">
              <Clock
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("contactPage.replyLabel")}
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("contactPage.replyValue")}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div
          id="contact-form"
          className="scroll-mt-24 rounded-[1.75rem] border-2 border-slate-200/90 bg-white/90 p-6 shadow-xl dark:border-transparent dark:bg-slate-950/70 md:p-8"
        >
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {t("contactPage.formTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("contactPage.formSubtitle", { email: SUPPORT_EMAIL })}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="contact-name">{t("contactPage.nameLabel")}</Label>
                <Input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  placeholder={t("contactPage.namePlaceholder")}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name)
                      setFieldErrors((f) => ({ ...f, name: "" }));
                  }}
                  className={cn(
                    "dark:border-transparent",
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
                <Label htmlFor="contact-email">
                  {t("contactPage.emailFieldLabel")}
                </Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("contactPage.emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email)
                      setFieldErrors((f) => ({ ...f, email: "" }));
                  }}
                  className={cn(
                    "dark:border-transparent",
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
                {t("contactPage.phoneLabel")}{" "}
                <span className="font-normal text-muted-foreground">
                  {t("contactPage.optional")}
                </span>
              </Label>
              <Input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder={t("contactPage.phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="dark:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-topic">{t("contactPage.topicLabel")}</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger
                  id="contact-topic"
                  className="h-11 rounded-lg border-2 dark:border-transparent"
                >
                  <SelectValue placeholder={t("contactPage.topicPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TOPIC_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`contactPage.topics.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">
                {t("contactPage.messageLabel")}
              </Label>
              <Textarea
                id="contact-message"
                name="message"
                rows={6}
                placeholder={t("contactPage.messagePlaceholder")}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (fieldErrors.message)
                    setFieldErrors((f) => ({ ...f, message: "" }));
                }}
                className={cn(
                  "min-h-[140px] rounded-lg border-2 border-input bg-background px-4 py-3 text-sm transition-colors focus-visible:ring-2 dark:border-transparent",
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
                  {t("contactPage.sending")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  {t("contactPage.submit")}
                </>
              )}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("contactPage.formFooter", { email: SUPPORT_EMAIL })}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
