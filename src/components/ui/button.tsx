import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'group inline-flex items-center justify-center whitespace-nowrap rounded-full font-mono text-[13px] font-medium tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border border-primary/90 hover:bg-primary/90 hover:brightness-105',
        destructive:
          'bg-destructive text-destructive-foreground border border-destructive/80 hover:bg-destructive/90',
        outline:
          'border border-border bg-card/60 text-foreground hover:bg-accent hover:border-foreground/25',
        secondary:
          'border border-border/80 bg-secondary text-secondary-foreground hover:bg-accent',
        ghost:
          'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
        link:
          'text-foreground underline-offset-4 hover:underline',
        glass:
          'glass-panel text-foreground border-border/80 hover:bg-accent/60',
      },
      size: {
        default: 'h-10 px-5 py-2 gap-2 text-[13px]',
        sm: 'h-8 px-4 gap-1.5 text-xs',
        lg: 'h-11 px-6 gap-2.5 text-sm',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
