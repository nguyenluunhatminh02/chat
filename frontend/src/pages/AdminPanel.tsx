import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

interface Report {
  id: string;
  type: 'MESSAGE' | 'USER' | 'CONVERSATION';
  reason: 'SPAM' | 'ABUSE' | 'NSFW' | 'HARASSMENT' | 'OTHER';
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  reportedBy: string;
  targetMessageId?: string;
  targetUserId?: string;
  targetConversationId?: string;
  details?: string;
  evidence?: {
    message?: {
      id: string;
      content: string;
      senderId: string;
      createdAt: string;
    };
  };
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function http(path: string, init?: RequestInit) {
  const userId = localStorage.getItem('x-user-id');
  const headers = new Headers(init?.headers);
  headers.set('X-User-Id', userId || '');
  headers.set('X-Admin', '1'); // Admin flag
  
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function listReports(status?: 'OPEN' | 'RESOLVED' | 'REJECTED'): Promise<Report[]> {
  const query = status ? `?status=${status}` : '';
  return http(`/moderation/reports${query}`);
}

function resolveReport(reportId: string, data: {
  action?: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER' | 'GLOBAL_BAN';
  resolutionNotes?: string;
}) {
  return http(`/moderation/reports/${reportId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

const REASON_LABELS = {
  SPAM: 'Spam',
  ABUSE: 'Abuse',
  NSFW: 'NSFW Content',
  HARASSMENT: 'Harassment',
  OTHER: 'Other',
};

const TYPE_LABELS = {
  MESSAGE: 'Message',
  USER: 'User',
  CONVERSATION: 'Conversation',
};

export function AdminPanel() {
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'REJECTED' | 'ALL'>('OPEN');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [action, setAction] = useState<'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER' | 'GLOBAL_BAN'>('NONE');
  const [notes, setNotes] = useState('');
  
  const queryClient = useQueryClient();
  
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', statusFilter],
    queryFn: () => listReports(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const resolveMutation = useMutation({
    mutationFn: (data: { reportId: string; action: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER' | 'GLOBAL_BAN'; resolutionNotes: string }) =>
      resolveReport(data.reportId, { action: data.action, resolutionNotes: data.resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedReport(null);
      setAction('NONE');
      setNotes('');
    },
  });

  const handleResolve = (status: 'RESOLVED' | 'REJECTED') => {
    if (!selectedReport) return;
    
    const finalAction = status === 'RESOLVED' ? action : 'NONE';
    const finalNotes = notes || (status === 'REJECTED' ? 'Report rejected - no action taken' : 'Report resolved');
    
    resolveMutation.mutate({
      reportId: selectedReport.id,
      action: finalAction,
      resolutionNotes: finalNotes,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-500">Manage reports and moderation</p>
              </div>
            </div>
            
            {/* Status filter */}
            <div className="flex gap-2">
              {(['ALL', 'OPEN', 'RESOLVED', 'REJECTED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-4 py-2 rounded-lg font-semibold text-sm transition-all',
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !reports || reports.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-semibold text-gray-600">No {statusFilter.toLowerCase()} reports</p>
            <p className="text-sm text-gray-500 mt-2">All clear! 🎉</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reports List */}
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={cn(
                    'bg-white rounded-lg p-4 border-2 cursor-pointer transition-all hover:shadow-lg',
                    selectedReport?.id === report.id
                      ? 'border-blue-500 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-bold',
                        report.status === 'OPEN' && 'bg-yellow-100 text-yellow-800',
                        report.status === 'RESOLVED' && 'bg-green-100 text-green-800',
                        report.status === 'REJECTED' && 'bg-red-100 text-red-800'
                      )}>
                        {report.status}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                        {TYPE_LABELS[report.type]}
                      </span>
                      <span className="px-2 py-1 bg-orange-100 rounded text-xs font-semibold text-orange-700">
                        {REASON_LABELS[report.reason]}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {report.details && (
                    <p className="text-sm text-gray-700 line-clamp-2 mb-2">{report.details}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>By: {typeof report.reportedBy === 'string' ? report.reportedBy.slice(0, 8) : 'User'}...</span>
                    {report.targetUserId && <span>User: {report.targetUserId.slice(0, 8)}...</span>}
                    {report.targetMessageId && <span>Msg: {report.targetMessageId.slice(0, 8)}...</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Report Detail Panel */}
            {selectedReport && (
              <div className="bg-white rounded-xl p-6 border-2 border-blue-500 shadow-xl sticky top-6 h-fit">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Report Details</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Report ID</label>
                    <p className="font-mono text-sm">{selectedReport.id}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Type & Reason</label>
                    <p className="text-sm">
                      {TYPE_LABELS[selectedReport.type]} - {REASON_LABELS[selectedReport.reason]}
                    </p>
                  </div>
                  
                  {selectedReport.details && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Details</label>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{selectedReport.details}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Reported By</label>
                    <p className="font-mono text-sm">{typeof selectedReport.reportedBy === 'string' ? selectedReport.reportedBy : JSON.stringify(selectedReport.reportedBy)}</p>
                  </div>
                  
                  {selectedReport.targetUserId && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Target User</label>
                      <p className="font-mono text-sm">{selectedReport.targetUserId}</p>
                    </div>
                  )}
                  
                  {selectedReport.targetMessageId && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Target Message</label>
                      <p className="font-mono text-sm">{selectedReport.targetMessageId}</p>
                    </div>
                  )}
                  
                  {selectedReport.evidence?.message && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Message Content</label>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        {selectedReport.evidence.message.content.startsWith('{"type":"IMAGE"') ? (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">🖼️ Image message</p>
                            {(() => {
                              try {
                                const fileData = JSON.parse(selectedReport.evidence.message.content);
                                return fileData.url ? (
                                  <img src={fileData.thumbUrl || fileData.url} alt="Reported content" className="max-h-48 rounded border" />
                                ) : (
                                  <p className="text-sm text-gray-600">{fileData.filename}</p>
                                );
                              } catch {
                                return <p className="text-sm text-gray-600">Invalid image data</p>;
                              }
                            })()}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedReport.evidence.message.content}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedReport.status === 'OPEN' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Action</label>
                      <select
                        value={action}
                        onChange={(e) => setAction(e.target.value as typeof action)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="NONE">No Action</option>
                        {selectedReport.type === 'MESSAGE' && (
                          <option value="DELETE_MESSAGE">Delete Message</option>
                        )}
                        {selectedReport.type === 'USER' && (
                          <>
                            <option value="BLOCK_USER">Block User</option>
                            <option value="GLOBAL_BAN">🔴 Global Ban (Permanent)</option>
                          </>
                        )}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this resolution..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResolve('RESOLVED')}
                        disabled={resolveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Resolve
                      </button>
                      
                      <button
                        onClick={() => handleResolve('REJECTED')}
                        disabled={resolveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-5 h-5" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {selectedReport.status !== 'OPEN' && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Resolution</h3>
                    <p className="text-sm text-gray-600">{selectedReport.resolutionNotes || 'No notes'}</p>
                    {selectedReport.resolvedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Resolved on {new Date(selectedReport.resolvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
