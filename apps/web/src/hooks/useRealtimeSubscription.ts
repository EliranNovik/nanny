import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionOptions {
  table: string;
  filter?: string;
  event?: SubscriptionEvent;
  schema?: string;
  enabled?: boolean;
  /**
   * Fires when the channel (re)joins after the first join. Events sent while
   * it was down are lost, so callers should refetch here.
   */
  onResubscribed?: () => void;
}

type SharedChannel = {
  channel: RealtimeChannel | null;
  count: number;
  emitter: EventTarget;
  joinedOnce: boolean;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelay: number;
  closed: boolean;
};

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 15000;

const activeChannels = new Map<string, SharedChannel>();
let topicSeq = 0;

function openChannel(
  key: string,
  shared: SharedChannel,
  binding: { event: SubscriptionEvent; schema: string; table: string; filter?: string },
) {
  // A fresh topic each time: reusing a topic that is still leaving hands back the dying channel.
  topicSeq += 1;
  const channel = supabase
    .channel(`${key}#${topicSeq}`)
    .on('postgres_changes' as any, binding, (payload: any) => {
      shared.emitter.dispatchEvent(new CustomEvent('payload', { detail: payload }));
    });
  shared.channel = channel;

  channel.subscribe((status) => {
    if (shared.closed || shared.channel !== channel) return;
    if (status === 'SUBSCRIBED') {
      shared.retryDelay = RETRY_MIN_MS;
      if (shared.joinedOnce) {
        shared.emitter.dispatchEvent(new Event('resubscribed'));
      }
      shared.joinedOnce = true;
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (shared.retryTimer) return;
      const delay = shared.retryDelay;
      shared.retryDelay = Math.min(delay * 2, RETRY_MAX_MS);
      shared.retryTimer = setTimeout(() => {
        shared.retryTimer = null;
        if (shared.closed) return;
        const stale = shared.channel;
        shared.channel = null;
        if (stale) void supabase.removeChannel(stale);
        openChannel(key, shared, binding);
      }, delay);
    }
  });
}

/**
 * Core deduped realtime hook.
 * Ref-counts listeners so identical subscriptions share one Supabase channel,
 * and rebuilds the channel when it errors, times out, or is closed by the server.
 */
export function useRealtimeSubscription(
  options: SubscriptionOptions,
  callback: (payload: any) => void
) {
  const { table, filter, event = '*', schema = 'public', enabled = true, onResubscribed } = options;

  const callbackRef = useRef(callback);
  const resubscribedRef = useRef(onResubscribed);
  useEffect(() => {
    callbackRef.current = callback;
    resubscribedRef.current = onResubscribed;
  }, [callback, onResubscribed]);

  useEffect(() => {
    if (!enabled) return;

    let isSubscribed = true;
    const key = `realtime:${schema}:${table}:${event}:${filter || 'all'}`;

    let shared = activeChannels.get(key);
    if (!shared) {
      shared = {
        channel: null,
        count: 0,
        emitter: new EventTarget(),
        joinedOnce: false,
        retryTimer: null,
        retryDelay: RETRY_MIN_MS,
        closed: false,
      };
      activeChannels.set(key, shared);
      openChannel(key, shared, { event, schema, table, filter });
    }

    shared.count++;

    const handler = (e: Event) => {
      if (isSubscribed) callbackRef.current((e as CustomEvent).detail);
    };
    const resubscribedHandler = () => {
      if (isSubscribed) resubscribedRef.current?.();
    };

    shared.emitter.addEventListener('payload', handler);
    shared.emitter.addEventListener('resubscribed', resubscribedHandler);

    return () => {
      isSubscribed = false;
      const current = activeChannels.get(key);
      if (!current) return;
      current.emitter.removeEventListener('payload', handler);
      current.emitter.removeEventListener('resubscribed', resubscribedHandler);
      current.count--;
      if (current.count <= 0) {
        current.closed = true;
        if (current.retryTimer) clearTimeout(current.retryTimer);
        if (current.channel) void supabase.removeChannel(current.channel);
        activeChannels.delete(key);
      }
    };
  }, [table, filter, event, schema, enabled]);
}
