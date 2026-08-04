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
