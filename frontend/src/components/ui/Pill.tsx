import React from 'react';
import { cn } from '../../utils/cn';

interface PillProps {
  children: React.ReactNode;
  className?: string;
}

export function Pill({ children, className }: PillProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700',
      className
    )}>
      {children}
    </span>
  );
}