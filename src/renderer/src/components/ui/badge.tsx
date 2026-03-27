import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium transition',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border bg-background text-foreground',
        success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
        warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
        muted: 'bg-slate-500/12 text-slate-600 dark:text-slate-300'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
