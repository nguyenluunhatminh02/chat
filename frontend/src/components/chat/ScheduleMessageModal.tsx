import { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '@radix-ui/react-label';

interface ScheduleMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: Date) => void;
  defaultContent?: string;
}

export function ScheduleMessageModal({
  open,
  onClose,
  onSchedule,
  defaultContent,
}: ScheduleMessageModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const handleSchedule = () => {
    if (!date || !time) {
      alert('Please select date and time');
      return;
    }

    const scheduledFor = new Date(`${date}T${time}`);
    
    if (scheduledFor <= new Date()) {
      alert('Scheduled time must be in the future');
      return;
    }

    onSchedule(scheduledFor);
    onClose();
  };

  // Set default to 1 hour from now
  const setDefaultDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    setDate(dateStr);
    setTime(timeStr);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Message</DialogTitle>
          <DialogDescription>
            Choose when to send this message
          </DialogDescription>
        </DialogHeader>

        {defaultContent && (
          <div className="p-3 text-sm rounded-md bg-muted">
            {defaultContent}
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">
              <Calendar className="inline w-4 h-4 mr-1" />
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="time">
              <Clock className="inline w-4 h-4 mr-1" />
              Time
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={setDefaultDateTime}
            className="w-full"
          >
            Set to 1 hour from now
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSchedule}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
