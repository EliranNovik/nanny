import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Search, Download, Shield, Settings, Trash, LogOut, MoreVertical, BadgeCheck } from "lucide-react";
import { apiPost, apiPatch } from "@/lib/api";
import { getAdminData, getCachedAdminData, invalidateAdminData } from "@/lib/adminDataCache";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { format } from "date-fns";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { LEGAL_VERSION } from "@/data/legalContentRevised";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";

interface UserProfile {
  id: string;
  role: "client" | "freelancer" | "admin";
  is_admin?: boolean;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
  is_verified?: boolean | null;
  kyc_status?: string | null;
  is_available_for_jobs?: boolean | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  legal_terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  legal_terms_version?: string | null;
  privacy_version?: string | null;
  age_18_confirmed_at?: string | null;
}

type UserJob = {
  status: string;
  client_id: string;
  selected_freelancer_id: string | null;
};

export default function AdminUsersPage() {
  const cachedDashboard = getCachedAdminData<{ users: UserProfile[]; jobs: UserJob[] }>("dashboard");
  const [users, setUsers] = useState<UserProfile[]>(cachedDashboard?.users || []);
  const [jobs, setJobs] = useState<UserJob[]>(cachedDashboard?.jobs || []);
  const [loading, setLoading] = useState(!cachedDashboard);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  
  // Settings modal state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Settings form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [role, setRole] = useState<"client" | "freelancer">("client");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [kycStatus, setKycStatus] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);


  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const closeActionMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      document
        .querySelectorAll<HTMLDetailsElement>("details[data-admin-user-actions][open]")
        .forEach((menu) => {
          if (!menu.contains(target)) menu.removeAttribute("open");
        });
    };
    document.addEventListener("pointerdown", closeActionMenus);
    return () => document.removeEventListener("pointerdown", closeActionMenus);
  }, []);

  async function fetchUsers() {
    if (!getCachedAdminData("dashboard")) setLoading(true);
    try {
      const data = await getAdminData<{ users: UserProfile[]; jobs: UserJob[] }>("dashboard", "/api/admin/dashboard");
      setUsers(data.users);
      setJobs(data.jobs);
    } catch (error) {
      console.error("Error loading users registry:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenSettings = (user: UserProfile) => {
    setSelectedUser(user);
    setFullName(user.full_name || "");
    setPhone(user.phone || "");
    setCity(user.city || "");
    setWhatsapp(user.whatsapp_number_e164 || "");
    setTelegram(user.telegram_username || "");
    setAgreementSigned(!!user.legal_terms_accepted_at && !!user.privacy_accepted_at);
    setRole(user.role === "admin" ? "client" : user.role);
    setIsAdmin(!!user.is_admin);
    setIsVerified(!!user.is_verified);
    setKycStatus(user.kyc_status || "unstarted");
    setIsAvailable(!!user.is_available_for_jobs);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedUser) return;
    setSavingSettings(true);
    try {
      const updates: Partial<UserProfile> = {
        full_name: fullName || null,
        phone: phone || null,
        city: city || null,
        whatsapp_number_e164: whatsapp.trim() || null,
        telegram_username: telegram.trim().replace(/^@/, "") || null,
        legal_terms_accepted_at: agreementSigned
          ? selectedUser.legal_terms_accepted_at || new Date().toISOString()
          : null,
        privacy_accepted_at: agreementSigned
          ? selectedUser.privacy_accepted_at || new Date().toISOString()
          : null,
        legal_terms_version: agreementSigned ? LEGAL_VERSION : null,
        privacy_version: agreementSigned ? LEGAL_VERSION : null,
        age_18_confirmed_at: agreementSigned
          ? selectedUser.age_18_confirmed_at || new Date().toISOString()
          : null,
        role: isAdmin ? "admin" as any : role,
        is_admin: isAdmin,
        is_verified: isVerified,
        kyc_status: kycStatus || null,
        is_available_for_jobs: isAvailable
      };

      await apiPatch(`/api/admin/users/${selectedUser.id}`, updates);
      setIsSettingsOpen(false);
      invalidateAdminData("dashboard");
      fetchUsers();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message || err}`);
    } finally {
      setSavingSettings(false);
    }
  };

  async function handleUserAction(userId: string, action: "disconnect" | "delete") {
    const confirmationText =
      action === "delete"
        ? "Are you sure you want to COMPLETELY DELETE this user? This removes authentication logins and operational records permanently."
        : "Are you sure you want to DISCONNECT this user profile? Operational logs will purge, but core credentials remain.";

    if (!window.confirm(confirmationText)) return;

    try {
      setLoading(true);
      const res = await apiPost<{ success: boolean; message?: string }>(
        `/api/admin/users/${userId}/action`,
        { action }
      );
      if (res.success) {
        invalidateAdminData("dashboard");
        fetchUsers();
      }
    } catch (err: any) {
      alert(`Administrative action failed: ${err.message || err}`);
      setLoading(false);
    }
  }

  // Filters logic
  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        !normalizedSearch ||
        (u.full_name || "").toLowerCase().includes(normalizedSearch) ||
        (u.phone || "").toLowerCase().includes(normalizedSearch) ||
        (u.city || "").toLowerCase().includes(normalizedSearch) ||
        u.id.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && u.is_admin) ||
        (roleFilter === "client" && u.role === "client" && !u.is_admin) ||
        (roleFilter === "freelancer" && u.role === "freelancer" && !u.is_admin);

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && u.is_verified) ||
        (verificationFilter === "unverified" && !u.is_verified);

      const matchesKyc = kycFilter === "all" || u.kyc_status === kycFilter;

      return matchesSearch && matchesRole && matchesVerification && matchesKyc;
    });

  const {
    visibleItems: paginatedUsers,
    hasMore,
    sentinelRef,
  } = useProgressiveList(filteredUsers, 30);

  const exportCSV = () => {
    if (filteredUsers.length === 0) return;
    const csvRows = [
      ["User ID", "Name", "Role", "Is Admin", "Phone", "City", "Verified", "KYC Status", "Created At"],
      ...filteredUsers.map((u) => [
        u.id,
        u.full_name || "N/A",
        u.role,
        u.is_admin ? "Yes" : "No",
        u.phone || "N/A",
        u.city || "N/A",
        u.is_verified ? "Yes" : "No",
        u.kyc_status || "unstarted",
        u.created_at
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "user_registry_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && users.length === 0) {
    return <AdminPageSkeleton columns={10} />;
  }

  return (
    <div className="admin-page admin-table-page min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-10">
      <div className="w-full px-4 py-6 lg:px-6 xl:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Users className="h-8 w-8 text-indigo-500" /> Users Registry
            </h1>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {/* Filter controls */}
        <div className="admin-filter-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-0">
          <div className="relative col-span-1 lg:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, phone, city or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All Roles</option>
              <option value="client">Clients (Employers)</option>
              <option value="freelancer">Freelancers (Helpers)</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <div>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All Verification</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified Only</option>
            </select>
          </div>

          <div>
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All KYC Statuses</option>
              <option value="unstarted">Unstarted</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="admin-table-panel overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
          <div className="admin-table-scroll overflow-auto">
          {/* Registry Header (Desktop) */}
          {paginatedUsers.length > 0 && (
            <div className="admin-users-grid admin-users-header hidden md:min-w-[1690px] md:grid gap-4 bg-zinc-50 px-6 py-3 text-xs font-bold text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 uppercase tracking-wider">
              <div>Participant</div>
              <div>Role</div>
              <div>Location</div>
              <div>WhatsApp</div>
              <div>Telegram</div>
              <div>Agreement signed</div>
              <div>Completed as client</div>
              <div>Completed as freelancer</div>
              <div>KYC Status</div>
              <div>Onboarded</div>
              <div aria-label="Actions" />
            </div>
          )}

        {/* Registry Rows */}
        {paginatedUsers.length === 0 ? (
          <Card className="border-0 bg-transparent py-16 text-center shadow-none">
            <CardContent>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No users found matching query.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginatedUsers.map((u) => (
              <div
                key={u.id}
                className="admin-users-grid flex flex-col md:min-w-[1690px] md:grid gap-3 items-start md:items-center px-4 py-3 md:px-6 md:py-2.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                {/* Column 1: Participant */}
                <div className="col-span-4 flex items-center gap-3 w-full min-w-0">
                  <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-800 shrink-0">
                    <AvatarImage src={u.photo_url || undefined} alt={u.full_name || "User Avatar"} />
                    <AvatarFallback className="bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                      {u.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50">
                      {u.full_name || "Anonymous"}
                      {u.is_verified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" aria-label="Verified" />
                      )}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{u.phone || "No phone listed"}</span>
                  </div>
                </div>

                {/* Column 2: Role */}
                <div className="col-span-2 flex items-center md:block">
                  <span className="md:hidden text-xs font-bold text-zinc-400 uppercase mr-2">Role:</span>
                  {u.is_admin ? (
                    <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs flex items-center gap-1 w-max">
                      <Shield className="h-3 w-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs w-max ${
                        u.role === "client" 
                          ? "bg-orange-50 text-orange-700 border border-orange-200/60 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40" 
                          : "bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40"
                      }`}
                    >
                      {u.role}
                    </Badge>
                  )}
                </div>

                {/* Column 3: Location */}
                <div className="col-span-2 flex items-center md:block text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-sm font-medium">
                  <span className="md:hidden text-xs font-bold text-zinc-400 uppercase mr-2">Location:</span>
                  {adminCityLabel(u.city)}
                </div>

                <div className="whitespace-nowrap text-sm">{u.whatsapp_number_e164 || "—"}</div>
                <div className="whitespace-nowrap text-sm">{u.telegram_username ? `@${u.telegram_username.replace(/^@/, "")}` : "—"}</div>
                <div className="whitespace-nowrap text-sm font-semibold">{u.legal_terms_accepted_at && u.privacy_accepted_at ? "Yes" : "No"}</div>
                <div className="whitespace-nowrap text-sm">{jobs.filter((job) => job.status === "completed" && job.client_id === u.id).length}</div>
                <div className="whitespace-nowrap text-sm">{jobs.filter((job) => job.status === "completed" && job.selected_freelancer_id === u.id).length}</div>

                {/* Column 4: KYC Status */}
                <div className="col-span-1 flex items-center md:block">
                  <span className="md:hidden text-xs font-bold text-zinc-400 uppercase mr-2">KYC:</span>
                  <Badge variant="outline" className={`capitalize text-xs font-semibold rounded-md ${
                    u.kyc_status === "approved" ? "border-emerald-200 text-emerald-700 bg-emerald-50/30 dark:border-emerald-900/40 dark:text-emerald-400" :
                    u.kyc_status === "pending" ? "border-amber-200 text-amber-700 bg-amber-50/30 dark:border-amber-900/40 dark:text-emerald-400" :
                    "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                  }`}>
                    {u.kyc_status || "unstarted"}
                  </Badge>
                </div>

                {/* Column 5: Onboarded */}
                <div className="col-span-1 flex items-center md:block text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-sm font-medium">
                  <span className="md:hidden text-xs font-bold text-zinc-400 uppercase mr-2">Onboarded:</span>
                  {format(new Date(u.created_at), "MMM d, yyyy")}
                </div>

                {/* Column 6: Operations */}
                <div className="col-span-2 flex w-full items-center justify-start md:w-auto md:justify-end">
                  <details className="relative" data-admin-user-actions>
                    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                      <MoreVertical className="h-5 w-5" />
                    </summary>
                    <div className="absolute right-0 top-0 z-50 w-48 overflow-hidden rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                      <button
                        onClick={(event) => {
                          handleOpenSettings(u);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <Settings className="h-4 w-4" /> Settings
                      </button>
                      {!u.is_admin && (
                        <>
                          <button
                            onClick={() => void handleUserAction(u.id, "disconnect")}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          >
                            <LogOut className="h-4 w-4" /> Disconnect
                          </button>
                          <button
                            onClick={() => void handleUserAction(u.id, "delete")}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash className="h-4 w-4" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ))}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {hasMore && <p className="py-3 text-center text-xs text-zinc-400">Loading more…</p>}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* User Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="admin-drawer-content max-w-md overflow-y-auto p-6">
          <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-500" /> User Settings Configuration
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure participant parameters, role properties, and marketplace permissions.
          </DialogDescription>

          {selectedUser && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.photo_url || undefined} />
                  <AvatarFallback className="bg-indigo-100 dark:bg-indigo-950/20 text-indigo-700">
                    {fullName?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
                    {selectedUser.full_name || "Anonymous User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate font-mono">
                    UID: {selectedUser.id}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">WhatsApp</label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+972…"
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Telegram</label>
                    <input
                      type="text"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@username"
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      disabled={isAdmin}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none"
                    >
                      <option value="client">Client</option>
                      <option value="freelancer">Freelancer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">KYC Status</label>
                    <select
                      value={kycStatus}
                      onChange={(e) => setKycStatus(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none"
                    >
                      <option value="unstarted">Unstarted</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Agreement Signed</span>
                    <button
                      type="button"
                      onClick={() => setAgreementSigned(!agreementSigned)}
                      className={`h-5 w-9 rounded-full transition-colors focus:outline-none relative flex items-center ${
                        agreementSigned ? "bg-emerald-500 justify-end" : "bg-zinc-200 justify-start"
                      }`}
                    >
                      <span className="h-4 w-4 bg-white rounded-full shadow-sm mx-0.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Administrator Credentials</span>
                    <button
                      type="button"
                      onClick={() => setIsAdmin(!isAdmin)}
                      className={`h-5 w-9 rounded-full transition-colors focus:outline-none relative flex items-center ${
                        isAdmin ? "bg-red-500 justify-end" : "bg-zinc-200 justify-start"
                      }`}
                    >
                      <span className="h-4 w-4 bg-white rounded-full shadow-sm mx-0.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Verified Platform Badge</span>
                    <button
                      type="button"
                      onClick={() => setIsVerified(!isVerified)}
                      className={`h-5 w-9 rounded-full transition-colors focus:outline-none relative flex items-center ${
                        isVerified ? "bg-emerald-500 justify-end" : "bg-zinc-200 justify-start"
                      }`}
                    >
                      <span className="h-4 w-4 bg-white rounded-full shadow-sm mx-0.5" />
                    </button>
                  </div>

                  {role === "freelancer" && !isAdmin && (
                    <div className="flex items-center justify-between animate-fade-in">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Available For Job Matching</span>
                      <button
                        type="button"
                        onClick={() => setIsAvailable(!isAvailable)}
                        className={`h-5 w-9 rounded-full transition-colors focus:outline-none relative flex items-center ${
                          isAvailable ? "bg-blue-500 justify-end" : "bg-zinc-200 justify-start"
                        }`}
                      >
                        <span className="h-4 w-4 bg-white rounded-full shadow-sm mx-0.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/40 mt-6">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  Save Settings
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-muted border border-border text-sm font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
