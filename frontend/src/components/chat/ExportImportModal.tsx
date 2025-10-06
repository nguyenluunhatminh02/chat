import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Download, Upload, FileJson, FileArchive, Loader2 } from 'lucide-react';
import { useExportConversation, useImportConversation } from '../../hooks/useTransfer';
import { toast } from 'react-hot-toast';

interface ExportImportModalProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

export function ExportImportModal({
  conversationId,
  open,
  onOpenChange,
  onImportSuccess,
}: ExportImportModalProps) {
  const exportMutation = useExportConversation();
  const importMutation = useImportConversation();

  const [exportFormat, setExportFormat] = useState<'json' | 'ndjson'>('ndjson');
  const [exportGzip, setExportGzip] = useState(true);
  const [exportFiles, setExportFiles] = useState<'meta' | 'presigned'>('meta');
  
  const [importMode, setImportMode] = useState<'create' | 'merge'>('merge');
  const [importPreserveIds, setImportPreserveIds] = useState(false);

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
    } catch (error) {
      console.error('Export failed:', error);
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(`Export failed: ${message}`);
    }
  }, [conversationId, exportFormat, exportGzip, exportFiles, exportMutation]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.json', '.ndjson', '.gz'];
    const isValid = validExtensions.some(ext => file.name.endsWith(ext));
    if (!isValid) {
      toast.error('Invalid file type. Please upload a .json, .ndjson, or .gz file');
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        file,
        options: {
          mode: importMode,
          conversationId: importMode === 'merge' ? conversationId : undefined,
          preserveIds: importPreserveIds,
          gzip: file.name.endsWith('.gz'),
        },
      });
      
      toast.success(
        `✅ Imported ${result.messages} messages${result.attachments > 0 ? ` and ${result.attachments} attachments` : ''}!`,
        { duration: 4000 }
      );
      
      onImportSuccess?.();
      
      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Import failed:', error);
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(`Import failed: ${message}`);
      // Reset file input on error too
      e.target.value = '';
    }
  }, [conversationId, importMode, importPreserveIds, importMutation, onImportSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Export / Import Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* EXPORT SECTION */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Download className="w-5 h-5" />
              <span>Export Conversation</span>
            </div>

            <div className="space-y-3">
              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('ndjson')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                      exportFormat === 'ndjson'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileArchive className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-sm font-medium">NDJSON</div>
                    <div className="text-xs text-gray-500">Large data</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                      exportFormat === 'json'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileJson className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-sm font-medium">JSON</div>
                    <div className="text-xs text-gray-500">Human readable</div>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportGzip}
                    onChange={(e) => setExportGzip(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Compress with gzip (smaller file)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportFiles === 'presigned'}
                    onChange={(e) => setExportFiles(e.target.checked ? 'presigned' : 'meta')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Include file download links (presigned URLs)</span>
                </label>
              </div>

              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                className="w-full flex items-center justify-center gap-2"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export Conversation</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* IMPORT SECTION */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Upload className="w-5 h-5" />
              <span>Import Conversation</span>
            </div>

            <div className="space-y-3">
              {/* Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Import Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportMode('merge')}
                    disabled={importMutation.isPending}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      importMode === 'merge'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">Merge</div>
                    <div className="text-xs text-gray-500">Add to this conversation</div>
                  </button>
                  <button
                    onClick={() => setImportMode('create')}
                    disabled={importMutation.isPending}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      importMode === 'create'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">Create New</div>
                    <div className="text-xs text-gray-500">New conversation</div>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importPreserveIds}
                    onChange={(e) => setImportPreserveIds(e.target.checked)}
                    disabled={importMutation.isPending}
                    className="w-4 h-4 text-green-600 rounded disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Preserve original IDs (if possible)</span>
                </label>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".json,.ndjson,.gz"
                  onChange={handleImport}
                  disabled={importMutation.isPending}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Button
                  disabled={importMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Select File to Import</span>
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Supports: .json, .ndjson, .json.gz, .ndjson.gz
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
