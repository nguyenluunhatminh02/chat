import { useState, useEffect } from 'react';
import { useActiveUsers, useRetention, useTopConversations } from '../hooks/useAnalytics';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';

export function AnalyticsPage() {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | undefined>();
  
  useEffect(() => {
    const wsId = localStorage.getItem('x-workspace-id') || 'ws_default';
    setCurrentWorkspaceId(wsId);
  }, []);
  const [activeRange, setActiveRange] = useState('30d');
  const [activeGranularity, setActiveGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [retentionWeeks, setRetentionWeeks] = useState(12);
  const [topRange, setTopRange] = useState('30d');

  const {
    data: activeData,
    isLoading: activeLoading,
    error: activeError,
  } = useActiveUsers(currentWorkspaceId, {
    granularity: activeGranularity,
    range: activeRange,
    tz: 'Asia/Ho_Chi_Minh',
  });

  const {
    data: retentionData,
    isLoading: retentionLoading,
    error: retentionError,
  } = useRetention(currentWorkspaceId, {
    weeks: retentionWeeks,
    tz: 'Asia/Ho_Chi_Minh',
  });

  const {
    data: topData,
    isLoading: topLoading,
    error: topError,
  } = useTopConversations(currentWorkspaceId, {
    range: topRange,
    limit: 20,
  });

  if (!currentWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500">Please select a workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            Workspace Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Track user activity, retention, and conversation metrics
          </p>
        </div>

        {/* Active Users Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Active Users</h2>
            </div>
            <div className="flex gap-2">
              <select
                value={activeGranularity}
                onChange={(e) => setActiveGranularity(e.target.value as 'day' | 'week' | 'month')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
              <select
                value={activeRange}
                onChange={(e) => setActiveRange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="60d">Last 60 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>

          {activeLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : activeError ? (
            <div className="text-red-500 text-center py-12">
              Error loading data: {(activeError as Error).message}
            </div>
          ) : activeData && activeData.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Total Active Users</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {activeData.reduce((sum, d) => sum + d.activeUsers, 0)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Total Messages</p>
                  <p className="text-2xl font-bold text-green-900">
                    {activeData.reduce((sum, d) => sum + d.messages, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">Avg Messages/Day</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {Math.round(
                      activeData.reduce((sum, d) => sum + d.messages, 0) / activeData.length
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-600">Active Users</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-600">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-2 text-sm text-gray-900">
                          {new Date(item.bucket).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-sm text-right font-medium text-blue-600">
                          {item.activeUsers}
                        </td>
                        <td className="py-2 text-sm text-right text-gray-600">
                          {item.messages.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No data available</div>
          )}
        </div>

        {/* Retention Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">User Retention (Weekly Cohorts)</h2>
            </div>
            <select
              value={retentionWeeks}
              onChange={(e) => setRetentionWeeks(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="4">4 weeks</option>
              <option value="8">8 weeks</option>
              <option value="12">12 weeks</option>
              <option value="16">16 weeks</option>
            </select>
          </div>

          {retentionLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : retentionError ? (
            <div className="text-red-500 text-center py-12">
              Error loading data: {(retentionError as Error).message}
            </div>
          ) : retentionData && retentionData.cohorts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Cohort</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Size</th>
                    {Array.from({ length: Math.min(retentionWeeks, 12) }, (_, i) => (
                      <th key={i} className="text-center py-2 px-2 font-medium text-gray-600">
                        W{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retentionData.cohorts.map((cohort) => {
                    const cohortMatrix = retentionData.matrix.filter(
                      (m) => m.cohortStartISO === cohort.cohortStartISO
                    );
                    return (
                      <tr key={cohort.cohortStartISO} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-900">
                          {new Date(cohort.cohortStartISO).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">{cohort.size}</td>
                        {Array.from({ length: Math.min(retentionWeeks, 12) }, (_, weekOffset) => {
                          const weekData = cohortMatrix.find((m) => m.weekOffset === weekOffset);
                          const percentage = weekData
                            ? Math.round((weekData.active / cohort.size) * 100)
                            : 0;
                          return (
                            <td
                              key={weekOffset}
                              className="py-2 px-2 text-center"
                              style={{
                                backgroundColor: weekData
                                  ? `rgba(34, 197, 94, ${percentage / 100})`
                                  : 'transparent',
                              }}
                            >
                              {weekData ? `${percentage}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No data available</div>
          )}
        </div>

        {/* Top Conversations Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">Top Conversations</h2>
            </div>
            <select
              value={topRange}
              onChange={(e) => setTopRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="60d">Last 60 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {topLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : topError ? (
            <div className="text-red-500 text-center py-12">
              Error loading data: {(topError as Error).message}
            </div>
          ) : topData && topData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">#</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Conversation</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Type</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Messages</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Participants</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {topData.map((conv, idx) => (
                    <tr key={conv.conversationId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm text-gray-500">{idx + 1}</td>
                      <td className="py-3 px-2 text-sm text-gray-900 font-medium">
                        {conv.title || 'Untitled'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            conv.type === 'GROUP'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {conv.type}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-right font-semibold text-orange-600">
                        {conv.messages.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-sm text-right text-gray-600">
                        {conv.uniqueSenders}
                      </td>
                      <td className="py-3 px-2 text-sm text-right text-gray-500">
                        {new Date(conv.lastActivity).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No conversations found</div>
          )}
        </div>
      </div>
    </div>
  );
}
