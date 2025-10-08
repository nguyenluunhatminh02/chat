import { Circle } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { UserStatus } from '../../hooks/useUserPresence';

interface PresenceDotProps {
  status: UserStatus;
  className?: string;
  showTooltip?: boolean;
}

const STATUS_CONFIG = {
  ONLINE: {
    color: 'bg-green-500',
    label: 'Online',
  },
  OFFLINE: {
    color: 'bg-gray-400',
    label: 'Offline',
  },
  AWAY: {
    color: 'bg-yellow-500',
    label: 'Away',
  },
  BUSY: {
    color: 'bg-red-500',
    label: 'Busy',
  },
  DO_NOT_DISTURB: {
    color: 'bg-red-600',
    label: 'Do Not Disturb',
  },
};

export function PresenceDot({ status, className, showTooltip = true }: PresenceDotProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.OFFLINE;

  return (
    <div
      className={cn('relative inline-flex', className)}
      title={showTooltip ? config.label : undefined}
    >
      <Circle
        className={cn(
          'h-3 w-3 fill-current',
          config.color,
          status === 'ONLINE' && 'animate-pulse'
        )}
      />
      {status === 'DO_NOT_DISTURB' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[2px] w-2 bg-white" />
        </div>
      )}
    </div>
  );
}
