import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { Button } from '../ui/Button';

interface VoiceRecorderProps {
  onRecordComplete: (audioBlob: Blob, duration: number) => void;
  onCancel?: () => void;
}

export function VoiceRecorder({ onRecordComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>(''); // lưu MIME thực tế
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const pickSupportedMime = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4', // Safari (m4a)
    ];
    for (const t of candidates) {
      if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported?.(t)) return t;
    }
    return ''; // để browser tự chọn mặc định
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMime();
      mimeRef.current = mimeType || '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blobType = mimeRef.current || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: blobType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        // dừng mic
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];
    onCancel?.();
  };

  const sendRecording = () => {
    if (chunksRef.current.length > 0) {
      const blobType = mimeRef.current || 'audio/webm';
      const audioBlob = new Blob(chunksRef.current, { type: blobType });
      onRecordComplete(audioBlob, duration);
      setAudioUrl(null);
      setDuration(0);
      chunksRef.current = [];
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-background">
      {!isRecording && !audioUrl && (
        <Button size="icon" variant="ghost" onClick={startRecording} className="text-red-500">
          <Mic className="w-5 h-5" />
        </Button>
      )}

      {isRecording && (
        <>
          <div className="flex items-center flex-1 gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono text-sm">{formatDuration(duration)}</span>
          </div>
          <Button size="icon" variant="ghost" onClick={stopRecording}>
            <Square className="w-5 h-5 fill-current" />
          </Button>
        </>
      )}

      {audioUrl && !isRecording && (
        <>
          <audio src={audioUrl} controls className="flex-1 h-10" />
          <span className="font-mono text-sm">{formatDuration(duration)}</span>
          <Button size="icon" variant="ghost" onClick={cancelRecording}>
            <Trash2 className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="default" onClick={sendRecording}>
            <Send className="w-5 h-5" />
          </Button>
        </>
      )}
    </div>
  );
}
