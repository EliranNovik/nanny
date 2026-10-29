import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Briefcase,
  CalendarDays,
  Clock3,
  Languages,
  MapPin,
  MessageSquare,
  Trash,
  Users,
  WalletCards,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { apiPatch, apiDelete } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { adminJobBudget, adminJobCategory } from "@/lib/adminJobPresentation";
import { getAdminData, getCachedAdminData } from "@/lib/adminDataCache";
import {
  JobAttachedPhotosStrip,
  jobAttachmentImageUrls,
} from "@/components/JobAttachedPhotosStrip";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string | null;
  service_type?: string | null;
  service_details?: Record<string, unknown> | null;
  title?: string | null;
  description?: string | null;
  time_duration?: string | null;
  location_address?: string | null;
  locked_at?: string | null;
  updated_at?: string | null;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  client_id: string;
  selected_freelancer_id: string | null;
  requirements?: string[];
  languages_pref?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  notes?: string | null;
  client?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  };
  freelancer?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  };
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not specified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/_/g, " ");
}

function detailLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface JobDetailsDialogProps {
  job: Job | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function JobDetailsDialog({ job, isOpen, onOpenChange, onRefresh }: JobDetailsDialogProps) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [notes, setNotes] = useState("");
  const [userJobsDrawer, setUserJobsDrawer] = useState<{
    name: string;
    role: "client" | "freelancer";
    jobs: Job[];
  } | null>(null);

  if (!job) return null;

  const categoryDetail =
    job.service_details?.other_type ||
    job.service_details?.custom_category ||
    job.service_details?.subcategory;
  const category = postServiceCategoryLabel(
    job.service_type || job.care_type,
    typeof categoryDetail === "string" ? categoryDetail : undefined,
  );
  const mediaUrls = jobAttachmentImageUrls(job);
  const serviceDetails = Object.entries(job.service_details || {}).filter(
    ([key, value]) =>
      key !== "images" && value !== null && value !== undefined && value !== "",
  );

  const startEdit = () => {
    setStatus(job.status);
    setStage(job.stage || "");
    setNotes(job.notes || "");
    setEditMode(true);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await apiPatch(`/api/admin/jobs/${job.id}`, {
        status,
        stage: stage || null,
        notes: notes || null
      });
      setEditMode(false);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update job: ${err.message || err}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to COMPLETELY DELETE this job request? This action is irreversible.")) return;
    
    setUpdating(true);
    try {
      await apiDelete(`/api/admin/jobs/${job.id}`);
      onOpenChange(false);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to delete job: ${err.message || err}`);
      setUpdating(false);
    }
  };

  const openConversation = async () => {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();
    if (conv) {
      navigate(`/chat/${conv.id}`);
      onOpenChange(false);
    } else {
      alert("No conversation logs established yet for this job.");
    }
  };

  const openUserJobs = async (
    userId: string,
    name: string,
    role: "client" | "freelancer",
  ) => {
    const cached = getCachedAdminData<{ jobs: Job[] }>("dashboard");
    const data =
      cached ||
      (await getAdminData<{ jobs: Job[] }>("dashboard", "/api/admin/dashboard"));
    setUserJobsDrawer({
      name,
      role,
      jobs: data.jobs.filter((candidate) =>
        role === "client"
          ? candidate.client_id === userId
          : candidate.selected_freelancer_id === userId,
      ),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="admin-drawer-content admin-job-details-drawer max-w-4xl overflow-y-auto border-0 bg-zinc-50 p-0 dark:bg-zinc-950">
        <div className="flex flex-col">
          {/* Header banner */}
          <div className="relative flex items-center justify-between overflow-hidden bg-white px-7 py-7 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-400">
                <Briefcase className="h-4 w-4" /> Job specification
              </div>
              <DialogTitle className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {job.title || category}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Review and manage the selected job.
              </DialogDescription>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Reference ID: <span className="font-mono">{job.id}</span>
              </p>
            </div>
          </div>

          {/* Content body */}
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
            {/* Left Column: Client & Freelancer Profiles */}
            <div className="flex flex-col justify-start space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:col-span-1">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  Employer (Client)
                </h4>
                <button
                  type="button"
                  onClick={() => void openUserJobs(job.client_id, job.client?.full_name || "Client", "client")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-zinc-50/50 p-3 text-left transition-colors hover:border-orange-400 hover:bg-orange-50/50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <Avatar className="h-11 w-11 shadow-sm border border-border/20">
                    <AvatarImage src={job.client?.photo_url || undefined} />
                    <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
                      {job.client?.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
                      {job.client?.full_name || "Anonymous Client"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.location_city || "No location listed"}
                    </p>
                  </div>
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  Assigned Helper (Freelancer)
                </h4>
                {job.freelancer ? (
                  <button
                    type="button"
                    onClick={() => void openUserJobs(job.freelancer!.id, job.freelancer?.full_name || "Freelancer", "freelancer")}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-zinc-50/50 p-3 text-left transition-colors hover:border-orange-400 hover:bg-orange-50/50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    <Avatar className="h-11 w-11 shadow-sm border border-border/20">
                      <AvatarImage src={job.freelancer.photo_url || undefined} />
                      <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
                        {job.freelancer.full_name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
                        {job.freelancer.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Platform Helper
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="p-3 text-center bg-zinc-50/30 dark:bg-zinc-900/20 rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground">
                    No helper currently assigned.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/40 mt-auto flex flex-col gap-2">
                <button
                  onClick={openConversation}
                  className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Open Conversation
                </button>
                <button
                  onClick={() => {
                    navigate(`/client/jobs/${job.id}/live`);
                    onOpenChange(false);
                  }}
                  className="w-full px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 border border-border/80 hover:border-border font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 shadow-sm"
                >
                  <Briefcase className="h-3.5 w-3.5" /> Live Tracking
                </button>

                {editMode ? (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleUpdate}
                      disabled={updating}
                      className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex-1 px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={startEdit}
                      className="flex-1 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs rounded-lg transition-all"
                    >
                      Edit Status
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={updating}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 rounded-lg transition-all flex items-center justify-center"
                      title="Delete Job"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Full specifications metadata */}
            <div className="space-y-5 md:col-span-2">
              {editMode ? (
                <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-border">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Admin Job Editor</h4>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-950 border border-border rounded-lg"
                    >
                      <option value="notifying">notifying</option>
                      <option value="confirmations_closed">confirmations_closed</option>
                      <option value="locked">locked</option>
                      <option value="active">active</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500">Stage</label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-950 border border-border rounded-lg"
                    >
                      <option value="">None (Clear stage)</option>
                      <option value="Matching">Matching</option>
                      <option value="Schedule">Schedule</option>
                      <option value="Live">Live</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500">Execution Directives & Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-950 border border-border rounded-lg"
                      placeholder="Add administrative notes or details here..."
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><Briefcase className="h-4 w-4 text-orange-500" /> Category</span>
                  <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {category}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><WalletCards className="h-4 w-4 text-emerald-500" /> Compensation</span>
                  <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {adminJobBudget(job)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><Clock3 className="h-4 w-4 text-sky-500" /> Duration / shift</span>
                  <p className="mt-2 text-sm font-bold capitalize text-zinc-900 dark:text-zinc-50">
                    {displayValue(job.time_duration || job.shift_hours)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><CalendarDays className="h-4 w-4 text-violet-500" /> Target schedule</span>
                  <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {job.start_at 
                      ? format(new Date(job.start_at), "MMM d, yyyy 'at' h:mm a") 
                      : "Flexible start date"}
                  </p>
                </div>
              </div>

              {mediaUrls.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <JobAttachedPhotosStrip
                    images={mediaUrls}
                    className="admin-job-media-strip border-0 bg-transparent p-2 dark:bg-transparent"
                  />
                </div>
              )}

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <MapPin className="h-4 w-4 text-red-500" /> Location & record
                </h4>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500">City</p>
                    <p className="mt-1 font-semibold">{adminCityLabel(job.location_city)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Address</p>
                    <p className="mt-1 font-semibold">{job.location_address || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Created</p>
                    <p className="mt-1 font-semibold">{format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Matched / locked</p>
                    <p className="mt-1 font-semibold">{job.locked_at ? format(new Date(job.locked_at), "MMM d, yyyy 'at' h:mm a") : "Not matched"}</p>
                  </div>
                </div>
              </div>

              {serviceDetails.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Service details
                  </h4>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {serviceDetails.map(([key, value]) => (
                      <div key={key} className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
                        <p className="text-xs text-zinc-500">{detailLabel(key)}</p>
                        <p className="mt-1 break-words text-sm font-semibold capitalize">{displayValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Care Specifics */}
              <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-border/30 pb-1.5">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Requirements & Support</span>
                </h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-zinc-500">Total Children:</div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {job.children_count || "0"} Children
                  </div>

                  <div className="text-zinc-500">Age Group Focus:</div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-50 capitalize">
                    {job.children_age_group}
                  </div>

                  <div className="text-zinc-500">Required Skills:</div>
                  <div className="flex flex-wrap gap-1 font-medium">
                    {job.requirements && job.requirements.length > 0 ? (
                      job.requirements.map((r: string, i: number) => (
                        <Badge key={i} variant="outline" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-tight bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300">
                          {r.replace("_", " ")}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-400 font-normal">No specialized skills tagged</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-zinc-500"><Languages className="h-3.5 w-3.5" /> Preferred Languages:</div>
                  <div className="flex flex-wrap gap-1 font-medium">
                    {job.languages_pref && job.languages_pref.length > 0 ? (
                      job.languages_pref.map((l: string, i: number) => (
                        <Badge key={i} variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-tight">
                          {l}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-400 font-normal">None specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirmation settings */}
              {(job.confirm_starts_at || job.confirm_ends_at) && (
                <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-border/30 pb-1.5">
                    Operational Windowing
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="text-zinc-500">Matching Opens:</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {job.confirm_starts_at ? format(new Date(job.confirm_starts_at), "MMM d, h:mm a") : "N/A"}
                    </div>
                    
                    <div className="text-zinc-500">Matching Closes:</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {job.confirm_ends_at ? format(new Date(job.confirm_ends_at), "MMM d, h:mm a") : "N/A"}
                    </div>
                  </div>
                </div>
              )}

              {job.description && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Job description</span>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{job.description}</p>
                </div>
              )}

              {/* Operational Notes */}
              {job.notes && !editMode && (
                <div className="space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 p-4 rounded-xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Execution Directives & Notes
                  </span>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                    "{job.notes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <Dialog
        open={Boolean(userJobsDrawer)}
        onOpenChange={(open) => !open && setUserJobsDrawer(null)}
      >
        <DialogContent className="admin-drawer-content max-w-3xl overflow-y-auto p-0">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <DialogTitle className="text-xl font-extrabold">
              {userJobsDrawer?.name} · All jobs
            </DialogTitle>
            <DialogDescription>
              {userJobsDrawer?.jobs.length || 0} jobs as {userJobsDrawer?.role}, sorted by category.
            </DialogDescription>
          </div>
          <div className="overflow-auto p-5">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3 text-right">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...(userJobsDrawer?.jobs || [])]
                  .sort((a, b) => adminJobCategory(a).localeCompare(adminJobCategory(b)))
                  .map((userJob) => (
                    <tr key={userJob.id}>
                      <td className="px-3 py-3 font-semibold">{adminJobCategory(userJob)}</td>
                      <td className="px-3 py-3 capitalize">{userJob.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-3 text-zinc-500">{format(new Date(userJob.created_at), "MMM d, yyyy")}</td>
                      <td className="px-3 py-3 text-right font-bold">{adminJobBudget(userJob)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
