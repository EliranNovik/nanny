// Utility functions for job stage badges and labels

export type JobStage = 
  | 'Request'
  | 'Price Offer'
  | 'Schedule'
  | 'Job in Progress'
  | 'Job Ended'
  | 'Payment'
  | 'Completed';

export interface StageBadge {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

export function getJobStageBadge(stage: string | null | undefined): StageBadge {
  if (!stage) {
    return { label: 'Request', variant: 'secondary' };
  }

  const map: Record<string, StageBadge> = {
    'Request': { 
      label: 'Request', 
      variant: 'secondary',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    },
    'Price Offer': { 
      label: 'Price Offer', 
      variant: 'secondary',
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
    },
    'Schedule': { 
      label: 'Schedule', 
      variant: 'default',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    },
    'Job in Progress': { 
      label: 'In Progress', 
      variant: 'default',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    },
    'Job Ended': { 
      label: 'Job Ended', 
      variant: 'outline',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    },
    'Payment': { 
      label: 'Payment', 
      variant: 'secondary',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    },
    'Completed': { 
      label: 'Completed', 
      variant: 'outline',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
    },
  };

  return map[stage] || { label: stage, variant: 'outline' };
}
