import * as React from 'react';
import { cn } from '@renderer/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const isInvalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';

  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        isInvalid && 'border-destructive text-destructive focus-visible:ring-destructive/20',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
