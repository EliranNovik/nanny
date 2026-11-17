import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { adminJobBudget, adminJobCategory } from "@/lib/adminJobPresentation";

type Person = { id: string; full_name: string | null } | Array<{ id: string; full_name: string | null }> | null;

type MemberJob = {
  id: string;
  status: string;
  service_type?: string | null;
  care_type?: string | null;
  service_details?: {
    other_type?: string | null;
    custom_category?: string | null;
    subcategory?: string | null;
  } | null;
  location_city: string | null;
  location_address?: string | null;
  created_at: string;
  updated_at?: string | null;
  start_at?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
  notes?: string | null;
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  client_id: string;
  selected_freelancer_id: string | null;
  client?: Person;
  freelancer?: Person;
};

function person(value: Person | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function when(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy");
}

function windowLabel(job: MemberJob) {
  if (job.confirm_starts_at || job.confirm_ends_at) {
    return `${when(job.confirm_starts_at)} – ${when(job.confirm_ends_at)}`;
  }
  if (job.start_at) return when(job.start_at);
  if (job.shift_hours) return job.shift_hours;
  return "—";
}

export default function AdminMemberJobsPage() {
  const { userId = "", side = "" } = useParams();
  const asHelper = side === "helper";
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (side !== "client" && side !== "helper") {
      setError("Unknown jobs list.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGet<{ jobs: MemberJob[] }>(`/api/admin/users/${userId}/jobs?as=${side}`)
      .then((data) => {
        if (!cancelled) setJobs(data.jobs ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load these jobs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, side]);

  const title = asHelper ? "Done as helper" : "Done as client";

  return (
    <div className="admin-page min-h-screen overflow-y-auto overscroll-contain bg-zinc-100 pb-16 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0">
      <div className="w-full px-4 py-6 md:px-8 xl:px-10">
        <Link
          to={`/admin/members/${userId}`}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Member
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {loading ? "Loading completed jobs." : `${jobs.length} completed job${jobs.length === 1 ? "" : "s"}.`}
        </p>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <p className="mt-8 rounded-3xl bg-white px-6 py-16 text-center text-sm text-zinc-600 dark:bg-zinc-900">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-white px-6 py-16 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            No completed jobs {asHelper ? "as a helper" : "as a client"}.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/60">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">{asHelper ? "Client" : "Helper"}</th>
                    <th className="px-4 py-3">Place</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {jobs.map((job) => {
                    const other = person(asHelper ? job.client : job.freelancer);
                    return (
                      <tr key={job.id} className="align-top">
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{adminJobCategory(job)}</td>
                        <td className="px-4 py-3">
                          {other?.id ? (
                            <Link
                              to={`/admin/members/${other.id}`}
                              className="font-semibold text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-100"
                            >
                              {other.full_name?.trim() || "Member"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {adminCityLabel(job.location_city)}
                          {job.location_address ? (
                            <span className="mt-0.5 block text-xs text-zinc-400">{job.location_address}</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{when(job.created_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{when(job.updated_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{windowLabel(job)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-100">{adminJobBudget(job)}</td>
                        <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">{job.notes?.trim() || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
