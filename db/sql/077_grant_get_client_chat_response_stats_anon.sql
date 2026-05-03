-- Allow anonymous callers to read aggregate client reply-time stats (same data shape as authenticated).
-- Used by discover “Open requests near you” after `get_discover_posted_help_requests_public` (no auth required for listing).

grant execute on function public.get_client_chat_response_stats(uuid[]) to anon;
