import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateReport } from '../../hooks/useModeration';
import { useAppContext } from '../../hooks/useAppContext';
import type { ReportReason } from '../../lib/moderation';

interface ReportMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageContent?: string;
}

const REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'SPAM', label: 'Spam', icon: '📧' },
  { value: 'ABUSE', label: 'Harassment or Abuse', icon: '⚠️' },
  { value: 'NSFW', label: 'Inappropriate Content (NSFW)', icon: '🔞' },
  { value: 'HARASSMENT', label: 'Bullying or Harassment', icon: '😡' },
  { value: 'OTHER', label: 'Other', icon: '❓' },
];

export function ReportMessageModal({
  open,
  onOpenChange,
  messageId,
  messageContent,
}: ReportMessageModalProps) {
  const { currentUserId } = useAppContext();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const createReport = useCreateReport(currentUserId);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    try {
      await createReport.mutateAsync({
        type: 'MESSAGE',
        targetMessageId: messageId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
        setSelectedReason(null);
        setDetails('');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit report:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Report Message
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Report Submitted
            </h3>
            <p className="text-sm text-gray-600">
              Thank you for helping keep our community safe.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Message Preview */}
            {messageContent && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Message:</p>
                <p className="text-sm text-gray-900 line-clamp-3">{messageContent}</p>
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Why are you reporting this message? *
              </label>
              <div className="space-y-2">
                {REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => setSelectedReason(reason.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedReason === reason.value
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className="text-2xl">{reason.icon}</span>
                    <span className="font-medium text-gray-900">{reason.label}</span>
                    {selectedReason === reason.value && (
                      <svg
                        className="ml-auto w-5 h-5 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <label htmlFor="details" className="block text-sm font-semibold text-gray-700 mb-2">
                Additional details (optional)
              </label>
              <Input
                id="details"
                type="text"
                placeholder="Provide more context..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={createReport.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedReason || createReport.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {createReport.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
