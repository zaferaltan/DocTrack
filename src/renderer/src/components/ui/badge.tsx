import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium transition',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border bg-background text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-[#E8F3EC] text-[#2F6B48] dark:bg-[#1F2E25] dark:text-[#8FD9A8]',
        warning: 'bg-[#FBF3DB] text-[#8F6400] dark:bg-[#332717] dark:text-[#EBCB8B]',
        muted: 'bg-secondary text-muted-foreground'
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
