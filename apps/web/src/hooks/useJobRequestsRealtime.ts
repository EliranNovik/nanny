import { useRealtimeSubscription } from './useRealtimeSubscription';

interface UseJobRequestsRealtimeProps {
  jobId: string | undefined;
  onJobUpdate: (payload: any) => void;
}

export function useJobRequestsRealtime({
  jobId,
  onJobUpdate,
}: UseJobRequestsRealtimeProps) {
  useRealtimeSubscription(
    {
      table: 'job_requests',
      event: 'UPDATE',
      filter: `id=eq.${jobId}`,
      enabled: !!jobId,
    },
    onJobUpdate
  );
}
