import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Download, FileJson, FileArchive, Loader2, Check } from 'lucide-react';
import { useExportConversation } from '../../hooks/useTransfer';
import { toast } from 'react-hot-toast';

interface ExportModalProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({
  conversationId,
  open,
  onOpenChange,
}: ExportModalProps) {
  const exportMutation = useExportConversation();

  const [exportFormat, setExportFormat] = useState<'json' | 'ndjson'>('ndjson');
  const [exportGzip, setExportGzip] = useState(true);
  const [exportFiles, setExportFiles] = useState<'meta' | 'presigned'>('meta');

  const handleExport = useCallback(async () => {
    try {
      await exportMutation.mutateAsync({
        conversationId,
        options: {
          format: exportFormat,
          gzip: exportGzip,
          files: exportFiles,
        },
      });
      toast.success(`Conversation exported as ${exportFormat.toUpperCase()}${exportGzip ? '.gz' : ''}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(`Export failed: ${message}`);
    }
  }, [conversationId, exportFormat, exportGzip, exportFiles, exportMutation, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-600" />
            Export Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportFormat('json')}
                className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                  exportFormat === 'json'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <FileJson className="w-4 h-4" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">JSON</div>
                  <div className="text-xs text-gray-500">Single file</div>
                </div>
                {exportFormat === 'json' && <Check className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setExportFormat('ndjson')}
                className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                  exportFormat === 'ndjson'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <FileArchive className="w-4 h-4" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">NDJSON</div>
                  <div className="text-xs text-gray-500">Line-delimited</div>
                </div>
                {exportFormat === 'ndjson' && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Compression */}
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Compress with GZIP</span>
              <button
                onClick={() => setExportGzip(!exportGzip)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  exportGzip ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    exportGzip ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
            <p className="text-xs text-gray-500">
              {exportGzip ? 'Files will be compressed (~70% smaller)' : 'Files will be uncompressed'}
            </p>
          </div>

          {/* File Handling */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">File Attachments</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  checked={exportFiles === 'meta'}
                  onChange={() => setExportFiles('meta')}
                  className="w-4 h-4 text-green-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Metadata Only</div>
                  <div className="text-xs text-gray-500">Export file info without downloading files</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  checked={exportFiles === 'presigned'}
                  onChange={() => setExportFiles('presigned')}
                  className="w-4 h-4 text-green-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Presigned URLs</div>
                  <div className="text-xs text-gray-500">Include temporary download links (24h expiry)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Conversation
              </>
            )}
          </Button>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">📦 What will be exported:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>All messages with content and metadata</li>
                <li>Conversation info (title, members, settings)</li>
                <li>Reactions, replies, and threads</li>
                <li>File attachments ({exportFiles === 'meta' ? 'metadata only' : 'with download links'})</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
