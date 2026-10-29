import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Trash2,
  Download,
  FileText,
  X,
  AlertTriangle,
  Calendar,
  Filter,
  RefreshCw,
  Image as ImageIcon,
  Video,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import { apiPatch, apiPost } from "@/lib/api";
import { getAdminData, getCachedAdminData, invalidateAdminDataPrefix } from "@/lib/adminDataCache";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { AdminTableSkeleton } from "@/components/admin/AdminPageSkeleton";
import { format } from "date-fns";
import { publicProfileMediaPublicUrl, publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { useNavigate } from "react-router-dom";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostType {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Post {
  id: string;
  caption: string | null;
  media_type: string | null;
  storage_path: string | null;
  created_at: string;
  custom_category: string | null;
  post_metadata: Record<string, unknown> | null;
  post_type_id: string | null;
  author_id: string;
  post_types: PostType | null;
  author: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    role: string | null;
  } | null;
  report_count?: number;
  reports?: Array<{
    id: string;
    reporter_id: string;
    reason: string;
    details: string | null;
    created_at: string;
    reporter: {
      id: string;
      full_name: string | null;
      photo_url: string | null;
    } | null;
  }>;
}

function postCategoryLabel(post: Post): string {
  const metadata = post.post_metadata || {};
  const raw =
    post.custom_category ||
    (typeof metadata.custom_category === "string" ? metadata.custom_category : null) ||
    (typeof metadata.subcategory === "string" ? metadata.subcategory : null) ||
    (typeof metadata.category === "string" ? metadata.category : null) ||
    post.post_types?.name ||
    "";
  if (!raw.trim()) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// ─── Image Preview Modal ────────────────────────────────────────────────────

function ImagePreviewModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Image */}
      <div
        className="relative z-10 max-w-4xl max-h-[90vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Post image preview"
          className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          style={{ background: "transparent" }}
        />
      </div>
    </div>
  );
}

function VideoPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <video src={url} controls autoPlay className="max-h-[85vh] max-w-full rounded-2xl bg-black shadow-2xl" />
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

function DeletePostModal({
  post,
  onClose,
  onDeleted,
}: {
  post: Post;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRESET_REASONS = [
    "Violates community guidelines",
    "Spam or misleading content",
    "Inappropriate or offensive content",
    "Duplicate post",
    "False or inaccurate information",
    "Harassment or abuse",
  ];

  async function handleDelete() {
    if (!reason.trim()) {
      setError("Please provide a reason for deletion.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/api/admin/posts/${post.id}/delete`, { reason });
      onDeleted(post.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete post.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="admin-custom-drawer absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Delete Post
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
              {post.caption
                ? `"${post.caption.slice(0, 80)}${post.caption.length > 80 ? "..." : ""}"`
                : "Untitled post"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5 text-sm">
            <span className="text-amber-600 dark:text-amber-400 mt-0.5">ℹ️</span>
            <p className="text-amber-700 dark:text-amber-300">
              A notification message from{" "}
              <strong>Tebnu</strong> will be automatically sent to{" "}
              <strong>{post.author?.full_name || "the author"}</strong> with
              your reason.
            </p>
          </div>

          {/* Preset reasons */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Quick Reasons
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    reason === r
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason textarea */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Reason for Deletion *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this post is being removed..."
              rows={3}
              className="w-full px-4 py-3 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors resize-none"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {reason.length}/500 characters
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || !reason.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? "Deleting..." : "Delete & Notify"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminPostsPage() {
  const navigate = useNavigate();
  const cachedPosts = getCachedAdminData<{ posts: Post[] }>("posts-v2:");
  const cachedPostTypes = getCachedAdminData<{ postTypes: PostType[] }>("post-types");
  const [posts, setPosts] = useState<Post[]>(cachedPosts?.posts || []);
  const [postTypes, setPostTypes] = useState<PostType[]>(cachedPostTypes?.postTypes || []);
  const [loading, setLoading] = useState(!cachedPosts);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [customCategoryFilter, setCustomCategoryFilter] = useState("all");
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [reportedPost, setReportedPost] = useState<Post | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const fetchPostTypes = useCallback(async () => {
    try {
      const data = await getAdminData<{ postTypes: PostType[] }>(
        "post-types",
        "/api/admin/post-types",
      );
      setPostTypes(data.postTypes || []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (typeFilter !== "all") params.set("type_id", typeFilter);
    if (customCategoryFilter !== "all")
      params.set("custom_category", customCategoryFilter);
    const queryString = params.toString();
    const cacheKey = `posts-v2:${queryString}`;
    if (!getCachedAdminData(cacheKey)) setLoading(true);
    try {
      const query = queryString ? `?${queryString}` : "";
      const data = await getAdminData<{ posts: Post[] }>(
        cacheKey,
        `/api/admin/posts${query}`,
      );
      setPosts(data.posts || []);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, typeFilter, customCategoryFilter]);

  useEffect(() => {
    fetchPostTypes();
  }, [fetchPostTypes]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      document.querySelectorAll<HTMLDetailsElement>("details[data-admin-post-actions][open]").forEach((menu) => {
        if (!menu.contains(target)) menu.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  // Client-side search filter
  const filteredPosts = posts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.caption || "").toLowerCase().includes(q) ||
      (p.author?.full_name || "").toLowerCase().includes(q) ||
      (p.custom_category || "").toLowerCase().includes(q) ||
      (p.post_types?.name || "").toLowerCase().includes(q) ||
      p.id.includes(q)
    );
  });

  const {
    visibleItems: paginatedPosts,
    hasMore,
    sentinelRef,
  } = useProgressiveList(filteredPosts, 30);

  const handlePostDeleted = (id: string) => {
    invalidateAdminDataPrefix("posts-v2:");
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const closeReport = async (reportId: string, status: "resolved" | "dismissed") => {
    try {
      await apiPatch(`/api/admin/reports/${reportId}`, { status });
      invalidateAdminDataPrefix("posts-v2:");
      setPosts((current) => current.map((post) => {
        const reports = (post.reports || []).filter((report) => report.id !== reportId);
        return reports.length === (post.reports || []).length
          ? post
          : { ...post, reports, report_count: reports.length };
      }));
      setReportedPost((current) => {
        if (!current) return null;
        const reports = (current.reports || []).filter((report) => report.id !== reportId);
        return { ...current, reports, report_count: reports.length };
      });
      setExpandedReportId(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to update report.");
    }
  };

  const exportCSV = () => {
    if (filteredPosts.length === 0) return;
    const rows = [
      [
        "Post ID",
        "Author",
        "Role",
        "Type",
        "Category",
        "Caption",
        "Media",
        "Created At",
      ],
      ...filteredPosts.map((p) => [
        p.id,
        p.author?.full_name || "Unknown",
        p.author?.role || "",
        p.post_types?.name || "Other",
        p.custom_category || "",
        (p.caption || "").replace(/\n/g, " "),
        p.media_type || "none",
        format(new Date(p.created_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "posts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unique custom categories for filter
  const customCategories = Array.from(
    new Set(posts.map((p) => p.custom_category).filter(Boolean))
  ) as string[];

  return (
    <div className="admin-page admin-table-page min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-10">
      <div className="w-full px-4 py-6 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FileText className="h-8 w-8 text-violet-500" /> Posts Management
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPosts}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="admin-filter-panel mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by author, caption, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Date From */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Post Type */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
              >
                <option value="all">All Post Types</option>
                {postTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.name}
                  </option>
                ))}
                <option value="null">Other / Custom</option>
              </select>
            </div>

            {/* Custom Category */}
            {customCategories.length > 0 && (
              <div>
                <select
                  value={customCategoryFilter}
                  onChange={(e) => setCustomCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                >
                  <option value="all">All Categories</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active filter summary */}
          {(fromDate || toDate || typeFilter !== "all" || customCategoryFilter !== "all") && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {fromDate && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 px-2.5 py-1 rounded-full">
                  From: {fromDate}
                  <button onClick={() => setFromDate("")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {toDate && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 px-2.5 py-1 rounded-full">
                  To: {toDate}
                  <button onClick={() => setToDate("")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {typeFilter !== "all" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 px-2.5 py-1 rounded-full">
                  Type: {postTypes.find((t) => t.id === typeFilter)?.name || typeFilter}
                  <button onClick={() => setTypeFilter("all")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {customCategoryFilter !== "all" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 px-2.5 py-1 rounded-full">
                  Category: {customCategoryFilter}
                  <button onClick={() => setCustomCategoryFilter("all")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {filteredPosts.length}
            </span>{" "}
            post{filteredPosts.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </div>
        </div>

        {/* Table */}
        <div className="admin-table-panel bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
          {loading ? (
            <AdminTableSkeleton rows={9} columns={7} />
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                No posts found
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="admin-table-scroll overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Author
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Post Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Caption
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Media
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Reported
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {paginatedPosts.map((post) => (
                    <tr
                      key={post.id}
                      onClick={() => {
                        setReportedPost(post);
                        setExpandedReportId(null);
                      }}
                      className="cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Author */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage
                              src={post.author?.photo_url || undefined}
                            />
                            <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {(post.author?.full_name || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[120px]">
                              {post.author?.full_name || "Unknown"}
                            </div>
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
                              {post.author?.role || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Post Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {post.post_types ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:shadow-sm dark:shadow-black/30"
                            style={{
                              backgroundColor: `${post.post_types.color}20`,
                              color: post.post_types.color,
                              border: `1px solid ${post.post_types.color}40`,
                            }}
                          >
                            {post.post_types.emoji} {post.post_types.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            📝 Other
                          </span>
                        )}
                      </td>

                      {/* Caption */}
                      <td className="px-4 py-3">
                        <p className="text-zinc-700 dark:text-zinc-300 line-clamp-2 max-w-[260px] text-xs leading-relaxed">
                          {post.caption || (
                            <span className="text-zinc-400 dark:text-zinc-500 italic">
                              No caption
                            </span>
                          )}
                        </p>
                      </td>

                      {/* Media */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {post.media_type === "image" && post.storage_path ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewImageUrl(
                                publicProfileMediaUrl(post.storage_path!, {
                                  width: 1200,
                                  quality: 88,
                                }),
                              );
                            }}
                            className="group relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 shadow-sm transition-all hover:border-violet-400 dark:border-zinc-700 dark:hover:border-violet-500"
                            title="Click to preview image"
                          >
                            <img
                              src={publicProfileMediaUrl(post.storage_path, {
                                width: 96,
                                quality: 70,
                              })}
                              alt="Post thumbnail"
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                        ) : post.media_type === "image" ? (
                          <Badge variant="outline" className="text-xs gap-1 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                            <ImageIcon className="w-3 h-3" /> Image
                          </Badge>
                        ) : post.media_type === "video" && post.storage_path ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewVideoUrl(publicProfileMediaPublicUrl(post.storage_path!));
                            }}
                            className="group relative h-14 w-14 overflow-hidden rounded-xl border border-purple-500/50 bg-black shadow-sm transition-all hover:border-purple-400"
                            title="Click to preview video"
                          >
                            <video
                              src={publicProfileMediaPublicUrl(post.storage_path)}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/45">
                              <Video className="h-5 w-5 text-white drop-shadow" />
                            </span>
                          </button>
                        ) : post.media_type === "video" ? (
                          <Badge variant="outline" className="text-xs gap-1 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20">
                            <Video className="w-3 h-3" /> Video
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            Text only
                          </span>
                        )}
                      </td>

                      {/* Custom Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {postCategoryLabel(post)}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {(post.report_count || 0) >= 2 ? (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white">
                            {post.report_count}
                          </span>
                        ) : (
                          <span className={`text-sm font-bold ${(post.report_count || 0) === 1 ? "text-red-600" : "text-zinc-400"}`}>
                            {post.report_count || 0}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {format(new Date(post.created_at), "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">
                          {format(new Date(post.created_at), "HH:mm")}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(event) => event.stopPropagation()}>
                        <details className="relative inline-block" data-admin-post-actions>
                          <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                            <MoreVertical className="h-5 w-5" />
                          </summary>
                          <div className="absolute right-0 top-0 z-50 w-48 rounded-xl bg-white p-1.5 text-left shadow-xl ring-1 ring-black/5 dark:bg-zinc-800">
                            <button
                              onClick={() => navigate(`/community/feed?post=${encodeURIComponent(post.id)}`)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <ExternalLink className="h-4 w-4" /> View on feed
                            </button>
                            <button
                              onClick={() => setDeletingPost(post)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div ref={sentinelRef} className="h-1" aria-hidden />
              {hasMore && <p className="py-3 text-center text-xs text-zinc-400">Loading more…</p>}
            </div>
          )}
        </div>
      </div>

      {reportedPost && (
        <div className="fixed inset-0 z-[9999]">
          <button
            type="button"
            aria-label="Close reports"
            className="absolute inset-0 bg-black/55"
            onClick={() => setReportedPost(null)}
          />
          <aside className="admin-custom-drawer absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">Post reports</h2>
                <p className="mt-1 text-sm text-zinc-500">{reportedPost.report_count || 0} reported issue{reportedPost.report_count === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setReportedPost(null)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {reportedPost.caption || "Post without a caption"}
            </div>

            <div className="space-y-2">
              {(reportedPost.reports || []).map((report) => {
                const expanded = expandedReportId === report.id;
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setExpandedReportId(expanded ? null : report.id)}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={report.reporter?.photo_url || undefined} />
                        <AvatarFallback>{report.reporter?.full_name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-zinc-900 dark:text-white">{report.reporter?.full_name || "Unknown user"}</p>
                        <p className="text-xs text-zinc-500">{format(new Date(report.created_at), "MMM d, yyyy 'at' HH:mm")}</p>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-700">
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Reason</p>
                        <p className="mt-1 font-semibold capitalize text-zinc-800 dark:text-zinc-100">{report.reason.replace(/_/g, " ")}</p>
                        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Report details</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{report.details || "No additional details provided."}</p>
                        <div className="mt-4 flex gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void closeReport(report.id, "resolved");
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Resolve
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void closeReport(report.id, "dismissed");
                            }}
                            className="rounded-lg bg-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100"
                          >
                            Dismiss
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
              {(reportedPost.reports || []).length === 0 && (
                <p className="py-16 text-center text-sm text-zinc-500">No reports for this post.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Image preview modal */}
      {previewImageUrl && (
        <ImagePreviewModal
          url={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}
      {previewVideoUrl && (
        <VideoPreviewModal
          url={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
      )}

      {/* Delete modal */}
      {deletingPost && (
        <DeletePostModal
          post={deletingPost}
          onClose={() => setDeletingPost(null)}
          onDeleted={handlePostDeleted}
        />
      )}
    </div>
  );
}
