import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    const isInvalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isInvalid && 'border-destructive text-destructive focus-visible:ring-destructive/20',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  }
);
Select.displayName = 'Select';
