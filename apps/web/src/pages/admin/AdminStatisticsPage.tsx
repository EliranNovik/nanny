import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Briefcase, TrendingUp, Sparkles, UserCheck } from "lucide-react";
import { getAdminData, getCachedAdminData } from "@/lib/adminDataCache";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";

interface Metrics {
  totalUsers: number;
  totalClients: number;
  totalFreelancers: number;
  verifiedUsers: number;
  activeUsersCount: number;
  activityRate: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  requestedJobs: number;
}

interface PostTypeStat {
  count: number;
  name: string;
  emoji: string;
  color: string;
  subcategories?: { name: string; count: number }[];
}

interface WeeklySignup {
  weekLabel: string;
  clients: number;
  freelancers: number;
}

interface WeeklyJob {
  weekLabel: string;
  jobsCreated: number;
}

type StatisticsPayload = {
  metrics: Metrics;
  postTypesStats: PostTypeStat[];
  weeklySignups: WeeklySignup[];
  weeklyJobs: WeeklyJob[];
};

export default function AdminStatisticsPage() {
  const cached = getCachedAdminData<StatisticsPayload>("statistics");
  const [metrics, setMetrics] = useState<Metrics | null>(cached?.metrics || null);
  const [postTypes, setPostTypes] = useState<PostTypeStat[]>(cached?.postTypesStats || []);
  const [weeklySignups, setWeeklySignups] = useState<WeeklySignup[]>(cached?.weeklySignups || []);
  const [weeklyJobs, setWeeklyJobs] = useState<WeeklyJob[]>(cached?.weeklyJobs || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    fetchStatistics();
  }, []);

  async function fetchStatistics() {
    if (!getCachedAdminData("statistics")) setLoading(true);
    try {
      const data = await getAdminData<StatisticsPayload>(
        "statistics",
        "/api/admin/statistics",
      );

      setMetrics(data.metrics);
      setPostTypes(data.postTypesStats);
      setWeeklySignups(data.weeklySignups);
      setWeeklyJobs(data.weeklyJobs);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !metrics) {
    return <AdminPageSkeleton summaryCards={4} columns={5} />;
  }

  const totalProfiles = metrics.totalClients + metrics.totalFreelancers;
  const clientPct = totalProfiles > 0 ? (metrics.totalClients / totalProfiles) * 100 : 0;
  const freelancerPct = totalProfiles > 0 ? (metrics.totalFreelancers / totalProfiles) * 100 : 0;
  const maxWeeklySignup = Math.max(...weeklySignups.map((w) => w.clients + w.freelancers), 1);
  const signupPoints = weeklySignups.map((w, idx) => {
    const x = (idx / (weeklySignups.length - 1)) * 340 + 30;
    const y = 160 - ((w.clients + w.freelancers) / maxWeeklySignup) * 110;
    return `${x},${y}`;
  }).join(" ");
  const maxWeeklyJobs = Math.max(...weeklyJobs.map((w) => w.jobsCreated), 1);
  const circ = 251.2;
  const clientOffset = circ - (clientPct / 100) * circ;
  const freelancerOffset = circ - (freelancerPct / 100) * circ;

  return (
    <div className="admin-page admin-table-page min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-10">
      <div className="w-full px-4 py-6 lg:px-6 xl:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-indigo-500" /> Platform Insights & Analytics
          </h1>
        </div>

        {/* Top metrics row */}
        <div className="grid shrink-0 grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden rounded-2xl border-0 border-t-4 border-t-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
              <CardTitle className="text-sm font-medium">Total Active Users (30d)</CardTitle>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <UserCheck className="h-6 w-6" />
              </span>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-extrabold tracking-tight">{metrics.activeUsersCount}</div>
              <div className="mt-1 text-xs font-medium text-muted-foreground">
                <span>{metrics.activityRate}% activity rate of platform</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(metrics.activityRate, 100)}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-0 border-t-4 border-t-violet-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
              <CardTitle className="text-sm font-medium">Verified Accounts</CardTitle>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                <Users className="h-6 w-6" />
              </span>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-extrabold tracking-tight">{metrics.verifiedUsers}</div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {Math.round((metrics.verifiedUsers / metrics.totalUsers) * 100)}% of users verified
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${metrics.totalUsers ? Math.min((metrics.verifiedUsers / metrics.totalUsers) * 100, 100) : 0}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-0 border-t-4 border-t-sky-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
              <CardTitle className="text-sm font-medium">Matched Assignments</CardTitle>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                <Briefcase className="h-6 w-6" />
              </span>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-extrabold tracking-tight">{metrics.activeJobs}</div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Locked & in active execution
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${metrics.totalJobs ? Math.min((metrics.activeJobs / metrics.totalJobs) * 100, 100) : 0}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-0 border-t-4 border-t-orange-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
              <CardTitle className="text-sm font-medium">Contract Completion</CardTitle>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                <TrendingUp className="h-6 w-6" />
              </span>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-extrabold tracking-tight">
                {metrics.totalJobs > 0 ? `${Math.round((metrics.completedJobs / metrics.totalJobs) * 100)}%` : "N/A"}
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {metrics.completedJobs} of {metrics.totalJobs} jobs resolved
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-orange-500" style={{ width: `${metrics.totalJobs ? Math.min((metrics.completedJobs / metrics.totalJobs) * 100, 100) : 0}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="admin-table-panel overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-bold">Detailed analytics</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Weekly activity, registrations and community content</p>
          </div>
          <div className="admin-table-scroll overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                <tr><th className="px-6 py-3">Period / category</th><th className="px-6 py-3">Clients</th><th className="px-6 py-3">Helpers</th><th className="px-6 py-3">Jobs</th><th className="px-6 py-3">Posts</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {weeklySignups.map((week, index) => (
                  <tr key={`week-${week.weekLabel}`}>
                    <td className="px-6 py-3 font-semibold">{week.weekLabel}</td>
                    <td className="px-6 py-3">{week.clients}</td>
                    <td className="px-6 py-3">{week.freelancers}</td>
                    <td className="px-6 py-3">{weeklyJobs[index]?.jobsCreated ?? 0}</td>
                    <td className="px-6 py-3 text-zinc-400">—</td>
                  </tr>
                ))}
                {postTypes.map((postType) => (
                  <tr key={`post-${postType.name}`}>
                    <td className="px-6 py-3 font-semibold">{postType.emoji} {postType.name}</td>
                    <td className="px-6 py-3 text-zinc-400">—</td>
                    <td className="px-6 py-3 text-zinc-400">—</td>
                    <td className="px-6 py-3 text-zinc-400">—</td>
                    <td className="px-6 py-3">{postType.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Section */}
        <div className="hidden grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Chart 1: Signups growth */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white sm:bg-white dark:bg-zinc-900 dark:sm:bg-zinc-900 shadow-xs lg:col-span-2 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50">
                <TrendingUp className="h-5 w-5 text-indigo-500" /> Account Registration Velocity (Past 8 Weeks)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Visualizes weekly user signup accumulation rate</CardDescription>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <div className="relative w-full h-full max-w-lg">
                <svg className="w-full h-full" viewBox="0 0 400 200">
                  {/* Grid Lines */}
                  <line x1="30" y1="50" x2="370" y2="50" stroke="rgba(150,150,150,0.15)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="30" y1="105" x2="370" y2="105" stroke="rgba(150,150,150,0.15)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="30" y1="160" x2="370" y2="160" stroke="rgba(150,150,150,0.3)" strokeWidth="1.5" />

                  {/* Draw the Polyline path */}
                  <polyline
                    fill="none"
                    stroke="url(#signupGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    points={signupPoints}
                  />

                  {/* Nodes & tooltip targets */}
                  {weeklySignups.map((w, idx) => {
                    const x = (idx / (weeklySignups.length - 1)) * 340 + 30;
                    const total = w.clients + w.freelancers;
                    const y = 160 - (total / maxWeeklySignup) * 110;
                    return (
                      <g key={idx} className="group cursor-pointer">
                        <circle cx={x} cy={y} r="5" className="fill-indigo-500 stroke-white dark:stroke-zinc-900 stroke-2 hover:r-7 transition-all" />
                        <text
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-zinc-800 dark:fill-zinc-200 hidden group-hover:block"
                        >
                          {total} (C:{w.clients} / H:{w.freelancers})
                        </text>
                      </g>
                    );
                  })}

                  {/* Labels */}
                  {weeklySignups.map((w, idx) => {
                    const x = (idx / (weeklySignups.length - 1)) * 340 + 30;
                    return (
                      <text key={idx} x={x} y="185" textAnchor="middle" className="text-[9px] font-bold fill-zinc-400 dark:fill-zinc-500">
                        {w.weekLabel}
                      </text>
                    );
                  })}

                  {/* Definitions */}
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Chart 2: Profile distributions */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white sm:bg-white dark:bg-zinc-900 dark:sm:bg-zinc-900 shadow-xs rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50">
                <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-300" /> User Roles Allocation
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Composition ratio of clients versus freelancers</CardDescription>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-around">
              {/* Donut Chart */}
              <div className="relative h-32 w-32 shrink-0">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(100,100,100,0.08)" strokeWidth="10" />
                  
                  {/* Clients Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="10"
                    strokeDasharray={circ}
                    strokeDashoffset={clientOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                  
                  {/* Freelancers Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray={circ}
                    strokeDashoffset={freelancerOffset}
                    strokeLinecap="round"
                    transform={`rotate(${clientPct * 3.6 - 90} 50 50)`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-zinc-900 dark:text-zinc-50">{totalProfiles}</span>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Members</span>
                </div>
              </div>

              {/* Legend details */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Clients</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">{metrics.totalClients} ({Math.round(clientPct)}%)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Helpers</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">{metrics.totalFreelancers} ({Math.round(freelancerPct)}%)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden grid-cols-1 md:grid-cols-2 gap-6">
          {/* Post categories list */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white sm:bg-white dark:bg-zinc-900 dark:sm:bg-zinc-900 shadow-xs rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50">
                <Sparkles className="h-5 w-5 text-amber-500" /> Community Posts by Type
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Breakdown of client/freelancer social posts grouped by post type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {postTypes.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-6">No posts recorded.</p>
              ) : (
                postTypes.map((pt, i) => {
                  const totalPosts = postTypes.reduce((sum, item) => sum + item.count, 0);
                  const pct = totalPosts > 0 ? (pt.count / totalPosts) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <span>{pt.emoji}</span>
                          <span>{pt.name}</span>
                        </span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{pt.count} posts</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pt.color || "#4f46e5"
                          }}
                        />
                      </div>
                      {pt.name === "Other" && pt.subcategories && pt.subcategories.length > 0 && (
                        <div className="mt-2 ml-5 pl-3 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-1.5 text-[11px]">
                          {pt.subcategories.map((sub, subIdx) => (
                            <div key={subIdx} className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                              <span className="font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                {sub.name}
                              </span>
                              <span className="font-bold">{sub.count} posts</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Weekly jobs created */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white sm:bg-white dark:bg-zinc-900 dark:sm:bg-zinc-900 shadow-xs rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50">
                <Briefcase className="h-5 w-5 text-blue-500" /> Contract Creation Velocity (Past 8 Weeks)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Number of job requests submitted per week</CardDescription>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <div className="w-full h-full max-w-md">
                <svg className="w-full h-full" viewBox="0 0 350 180">
                  {/* Grid Lines */}
                  <line x1="20" y1="40" x2="330" y2="40" stroke="rgba(150,150,150,0.15)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="20" y1="90" x2="330" y2="90" stroke="rgba(150,150,150,0.15)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="20" y1="140" x2="330" y2="140" stroke="rgba(150,150,150,0.3)" strokeWidth="1.5" />

                  {/* Draw bars */}
                  {weeklyJobs.map((w, idx) => {
                    const barWidth = 24;
                    const barGap = 12;
                    const x = 30 + idx * (barWidth + barGap);
                    const barHeight = (w.jobsCreated / maxWeeklyJobs) * 90;
                    const y = 140 - barHeight;

                    return (
                      <g key={idx} className="group cursor-pointer">
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="4"
                          className="fill-blue-500 hover:fill-blue-600 transition-colors"
                        />
                        <text
                          x={x + barWidth / 2}
                          y={y - 8}
                          textAnchor="middle"
                          className="text-[9px] font-bold fill-zinc-800 dark:fill-zinc-200 hidden group-hover:block"
                        >
                          {w.jobsCreated}
                        </text>
                      </g>
                    );
                  })}

                  {/* Labels */}
                  {weeklyJobs.map((w, idx) => {
                    const barWidth = 24;
                    const barGap = 12;
                    const x = 30 + idx * (barWidth + barGap) + barWidth / 2;
                    return (
                      <text key={idx} x={x} y="160" textAnchor="middle" className="text-[9px] font-bold fill-zinc-400 dark:fill-zinc-500">
                        {w.weekLabel}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
