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
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { format } from "date-fns";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [customCategoryFilter, setCustomCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const itemsPerPage = 20;

  const fetchPostTypes = useCallback(async () => {
    try {
      const data = await apiGet<{ postTypes: PostType[] }>(
        "/api/admin/post-types"
      );
      setPostTypes(data.postTypes || []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (typeFilter !== "all") params.set("type_id", typeFilter);
      if (customCategoryFilter !== "all")
        params.set("custom_category", customCategoryFilter);

      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiGet<{ posts: Post[] }>(
        `/api/admin/posts${query}`
      );
      setPosts(data.posts || []);
      setCurrentPage(1);
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

  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePostDeleted = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-10">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FileText className="h-8 w-8 text-violet-500" /> Posts Management
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Review, filter, and moderate all community posts
            </p>
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by author, caption, type..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
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
              <div className="lg:col-span-2">
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
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
            <div className="overflow-x-auto">
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
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
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
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
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
                            onClick={() =>
                              setPreviewImageUrl(
                                publicProfileMediaUrl(post.storage_path!, {
                                  width: 1200,
                                  quality: 88,
                                })
                              )
                            }
                            className="group relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 transition-all shadow-sm flex-shrink-0"
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
                        {post.custom_category ? (
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                            {post.custom_category}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300 dark:text-zinc-600">
                            —
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
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setDeletingPost(post)}
                          title="Delete post"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Page {currentPage} of {totalPages} · {filteredPosts.length} total
              posts
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(
                  1,
                  Math.min(totalPages - 4, currentPage - 2)
                ) + i;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 text-sm font-semibold rounded-xl transition-colors ${
                      currentPage === page
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {previewImageUrl && (
        <ImagePreviewModal
          url={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
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
