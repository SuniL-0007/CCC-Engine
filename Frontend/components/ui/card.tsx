import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-white text-slate-950 shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('border-b p-4', className)} {...props} />
  );
}

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-bold', className)} {...props} />
  );
}

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div className={cn('p-4', className)} {...props} />
  );
}
