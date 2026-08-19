import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "clay-press inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_10px_22px_-8px_var(--clay-drop-lg),inset_3px_3px_7px_oklch(1_0_0/0.28),inset_-4px_-4px_9px_oklch(0_0_0/0.18)] hover:bg-primary',
        destructive: 'bg-destructive text-background focus-visible:ring-ring/30',
        outline: 'clay hover:text-foreground',
        secondary: 'clay-inset text-secondary-foreground',
        ghost: 'shadow-none hover:bg-accent hover:text-accent-foreground hover:shadow-none active:shadow-none',
        link: 'text-primary underline-offset-4 shadow-none hover:underline hover:shadow-none active:shadow-none',
      },
      size: {
        default: 'h-10 px-5 has-[>svg]:px-4',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-9 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-11 px-6 text-[0.9375rem] has-[>svg]:px-5',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
