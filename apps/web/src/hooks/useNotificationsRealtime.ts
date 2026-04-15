import { useRealtimeSubscription } from './useRealtimeSubscription';

interface UseNotificationsRealtimeProps {
  userId: string | undefined;
  onNotificationUpdate: (payload: any) => void;
  onConfirmationUpdate: (payload: any) => void;
}

export function useNotificationsRealtime({
  userId,
  onNotificationUpdate,
  onConfirmationUpdate,
}: UseNotificationsRealtimeProps) {
  
  // Watch for notification changes
  useRealtimeSubscription(
    {
      table: 'job_candidate_notifications',
      event: '*',
      filter: `freelancer_id=eq.${userId}`,
      enabled: !!userId,
    },
    onNotificationUpdate
  );

  // Watch for confirmation changes
  useRealtimeSubscription(
    {
      table: 'job_confirmations',
      event: 'UPDATE', // specifically tracking when client declines
      filter: `freelancer_id=eq.${userId}`,
      enabled: !!userId,
    },
    onConfirmationUpdate
  );
}
