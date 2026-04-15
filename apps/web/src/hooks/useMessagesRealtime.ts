import { useRealtimeSubscription } from './useRealtimeSubscription';

interface UseMessagesRealtimeProps {
  conversationIds: string[];
  onMessageChange: (payload: any) => void;
}

export function useMessagesRealtime({
  conversationIds,
  onMessageChange,
}: UseMessagesRealtimeProps) {
  const filter = conversationIds.length > 0 
    ? (conversationIds.length === 1 ? `conversation_id=eq.${conversationIds[0]}` : `conversation_id=in.(${conversationIds.join(',')})`)
    : undefined;

  useRealtimeSubscription(
    {
      table: 'messages',
      event: '*',
      filter,
      enabled: conversationIds.length > 0,
    },
    onMessageChange
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
  const filter = conversationIds.length > 0 
    ? (conversationIds.length === 1 ? `conversation_id=eq.${conversationIds[0]}` : `conversation_id=in.(${conversationIds.join(',')})`)
    : undefined;

  useRealtimeSubscription(
    {
      table: 'payments',
      event: '*',
      filter,
      enabled: conversationIds.length > 0,
    },
    onPaymentChange
  );
}
