import { Check, Copy, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopy } from '@/hooks/use-copy';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  size?: 'sm' | 'icon-sm';
}

export function CopyButton({
  value,
  label,
  className,
  variant = 'ghost',
  size = 'sm',
}: CopyButtonProps) {
  const { copy, copied, failed } = useCopy();

  const Icon = failed ? X : copied ? Check : Copy;
  const text = failed ? 'Press Ctrl+C' : copied ? 'Copied' : label;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => void copy(value)}
      aria-label={label ? undefined : `Copy ${value}`}
      className={cn(
        'shrink-0 font-mono text-xs',
        copied && 'text-primary',
        failed && 'text-destructive',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {text ? <span>{text}</span> : null}
    </Button>
  );
}
