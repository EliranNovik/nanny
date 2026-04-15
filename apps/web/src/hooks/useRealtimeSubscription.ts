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
}

const activeChannels = new Map<string, { channel: RealtimeChannel; count: number; emitter: EventTarget }>();

/**
 * Core deduped realtime hook.
 * Avoids creating a monolithic "global manager" state machine, but prevents 
 * exact duplicate Supabase channels from leaking by ref-counting listeners.
 */
export function useRealtimeSubscription(
  options: SubscriptionOptions,
  callback: (payload: any) => void
) {
  const { table, filter, event = '*', schema = 'public', enabled = true } = options;
  
  // Use a ref to ensure we always call the latest callback without needing to re-bind event listeners
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (!enabled) return;
    
    let isSubscribed = true;
    const channelId = `realtime:${schema}:${table}:${event}:${filter || 'all'}`;
    
    let ref = activeChannels.get(channelId);
    
    if (!ref) {
      const emitter = new EventTarget();
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event, schema, table, filter },
          (payload) => {
            const customEvent = new CustomEvent('payload', { detail: payload });
            emitter.dispatchEvent(customEvent);
          }
        )
        .subscribe();
        
      ref = { channel, count: 0, emitter };
      activeChannels.set(channelId, ref);
    }
    
    ref.count++;
    
    const handler = (e: Event) => {
      if (isSubscribed) {
        callbackRef.current((e as CustomEvent).detail);
      }
    };
    
    ref.emitter.addEventListener('payload', handler);
    
    return () => {
      isSubscribed = false;
      const currentRef = activeChannels.get(channelId);
      if (currentRef) {
        currentRef.emitter.removeEventListener('payload', handler);
        currentRef.count--;
        
        // Cleanup channel if no one is listening anymore
        if (currentRef.count <= 0) {
          supabase.removeChannel(currentRef.channel);
          activeChannels.delete(channelId);
        }
      }
    };
  }, [table, filter, event, schema, enabled]);
}
