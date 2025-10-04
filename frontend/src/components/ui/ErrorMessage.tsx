import { cn } from '../../utils/cn';

interface ErrorMessageProps {
  message: string;
  className?: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, className, onRetry }: ErrorMessageProps) {
  return (
    <div className={cn(
      'rounded-md bg-red-50 border border-red-200 p-4',
      className
    )}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-red-400">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-red-800">{message}</p>
        </div>
        {onRetry && (
          <div className="ml-3">
            <button
              onClick={onRetry}
              className="text-sm text-red-600 hover:text-red-500 font-medium"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}