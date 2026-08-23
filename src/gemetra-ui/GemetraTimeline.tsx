import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export interface TimelineStep {
  id: string;
  title: string;
  description?: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
}

interface GemetraTimelineProps {
  steps: TimelineStep[];
  compact?: boolean;
  className?: string;
}

export const GemetraTimeline: React.FC<GemetraTimelineProps> = ({ steps, compact, className }) => (
  <div className={clsx('space-y-0', className)}>
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      return (
        <div key={step.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            {step.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-[var(--gem-success)]" />
            ) : step.status === 'current' ? (
              <Clock className="h-5 w-5 text-[var(--gem-brand)]" />
            ) : (
              <Circle className="h-5 w-5 text-[var(--gem-border)]" />
            )}
            {!isLast && <div className="my-1 w-px flex-1 min-h-[24px] bg-[var(--gem-border)]" />}
          </div>
          <div className={clsx('pb-6', isLast && 'pb-0')}>
            <div className="flex items-center gap-2">
              <p className={clsx('gem-sans font-medium', compact ? 'text-sm' : 'text-base', step.status === 'pending' && 'text-[var(--gem-text-muted)]')}>
                {step.title}
              </p>
              {step.timestamp && (
                <span className="text-xs text-[var(--gem-text-muted)]">{step.timestamp}</span>
              )}
            </div>
            {step.description && !compact && (
              <p className="mt-1 text-sm text-[var(--gem-text-muted)]">{step.description}</p>
            )}
          </div>
        </div>
      );
    })}
  </div>
);
