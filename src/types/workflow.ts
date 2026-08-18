export interface WorkflowStep {
  id: string;
  name: string;
  type: 'trigger' | 'condition' | 'action' | 'notification';
  config: Record<string, any>;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'failed';
  triggerType: 'cron' | 'event' | 'webhook' | 'manual';
  schedule?: string;
  stepsCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed';
  /** The full cron command, used by "Run now". Present for cron-sourced workflows. */
  command?: string;
  /** Which crontab the entry came from (/etc/crontab, /etc/cron.d/x, root crontab). */
  source?: string;
  steps: WorkflowStep[];
}

export interface QueueJob {
  id: string;
  title: string;
  nodeName: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progressPercent: number;
  startedAt: string;
  durationSeconds?: number;
  logs?: string[];
}
