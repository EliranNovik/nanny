import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, MessageSquare, Trash } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getJobStageBadge } from "@/lib/jobStages";
import { apiPatch, apiDelete } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string | null;
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

  if (!job) return null;

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border border-border/40 bg-card p-0">
        <div className="flex flex-col">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-zinc-50 px-6 py-5 flex items-center justify-between border-b border-white/10 rounded-t-2xl">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white animate-fade-in">
                Job Specification Detail
              </DialogTitle>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Reference ID: <span className="font-mono">{job.id}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none px-2.5 py-0.5 text-xs font-semibold shadow-sm uppercase tracking-wide">
                {job.status}
              </Badge>
              {job.stage && (
                <Badge variant={getJobStageBadge(job.stage).variant} className="px-2.5 py-0.5 text-xs font-semibold shadow-sm uppercase tracking-wide">
                  {getJobStageBadge(job.stage).label}
                </Badge>
              )}
            </div>
          </div>

          {/* Content body */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Client & Freelancer Profiles */}
            <div className="space-y-6 md:col-span-1 border-r border-border/40 pr-0 md:pr-6 flex flex-col justify-start">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  Employer (Client)
                </h4>
                <div className="flex items-center gap-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-border/40">
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
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  Assigned Helper (Freelancer)
                </h4>
                {job.freelancer ? (
                  <div className="flex items-center gap-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-border/40">
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
                  </div>
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
            <div className="md:col-span-2 space-y-6">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                  <span className="text-xs text-zinc-500 font-medium">Care Category</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5 capitalize">
                    {job.care_type?.replace("_", " ")}
                  </p>
                </div>

                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                  <span className="text-xs text-zinc-500 font-medium">Compensation Range</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {job.budget_min && job.budget_max 
                      ? `$${job.budget_min} - $${job.budget_max}/hr` 
                      : "Rate custom/not specified"}
                  </p>
                </div>

                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                  <span className="text-xs text-zinc-500 font-medium">Shift Parameters</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5 capitalize">
                    {job.shift_hours?.replace("_", " ")}
                  </p>
                </div>

                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                  <span className="text-xs text-zinc-500 font-medium">Target Schedule</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    {job.start_at 
                      ? format(new Date(job.start_at), "MMM d, yyyy 'at' h:mm a") 
                      : "Flexible start date"}
                  </p>
                </div>
              </div>

              {/* Care Specifics */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-border/30 pb-1.5">
                  Requirements & Support
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

                  <div className="text-zinc-500">Preferred Languages:</div>
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
                <div className="space-y-3 pt-2">
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
    </Dialog>
  );
}
