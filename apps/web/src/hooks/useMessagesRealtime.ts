import { useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface UseMessagesRealtimeProps {
  conversationIds: string[];
  onMessageChange: (payload: any) => void;
}

/**
 * Realtime hook for messages.
 * NOTE: Supabase Realtime does NOT support the 'in.' filter operator.
 * If multiple conversationIds are provided, we subscribe to all accessible messages
 * and filter them locally in JS to ensure live updates work for merged conversation histories.
 */
export function useMessagesRealtime({
  conversationIds,
  onMessageChange,
}: UseMessagesRealtimeProps) {
  const hasMultiple = conversationIds.length > 1;
  const filter = conversationIds.length === 1 
    ? `conversation_id=eq.${conversationIds[0]}` 
    : undefined;

  const wrappedCallback = useCallback((payload: any) => {
    if (hasMultiple) {
      const convoId = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!convoId || !conversationIds.includes(convoId)) return;
    }
    onMessageChange(payload);
  }, [conversationIds, onMessageChange, hasMultiple]);

  useRealtimeSubscription(
    {
      table: 'messages',
      event: '*',
      filter,
      enabled: conversationIds.length > 0,
    },
    wrappedCallback
  );
}

interface UsePaymentsRealtimeProps {
  conversationIds: string[];
  onPaymentChange: (payload: any) => void;
}

export function usePaymentsRealtime({
  conversationIds,
  onPaymentChange,
}: UsePaymentsRealtimeProps) {
  const hasMultiple = conversationIds.length > 1;
  const filter = conversationIds.length === 1 
    ? `conversation_id=eq.${conversationIds[0]}` 
    : undefined;

  const wrappedCallback = useCallback((payload: any) => {
    if (hasMultiple) {
      const convoId = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!convoId || !conversationIds.includes(convoId)) return;
    }
    onPaymentChange(payload);
  }, [conversationIds, onPaymentChange, hasMultiple]);

  useRealtimeSubscription(
    {
      table: 'payments',
      event: '*',
      filter,
      enabled: conversationIds.length > 0,
    },
    wrappedCallback
  );
}
