import { useWorkspaceMembers } from '../../hooks/useWorkspaces';
import { useUsers } from '../../hooks/useUsers';
import { useAppContext } from '../../hooks/useAppContext';
import { Button } from '../ui/Button';
import { Crown, Shield, User as UserIcon, X } from 'lucide-react';
import type { User } from '../../types';

interface WorkspaceMembersPanelProps {
  workspaceId: string;
  onClose: () => void;
}

export function WorkspaceMembersPanel({ workspaceId, onClose }: WorkspaceMembersPanelProps) {
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
  const { data: allUsers } = useUsers();
  const { currentUserId } = useAppContext();
  
  const getUserById = (userId: string): User | undefined => {
    return (allUsers as User[])?.find(u => u.id === userId);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-indigo-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      default:
        return 'Member';
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-80 bg-white border-l shadow-xl z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">Workspace Members</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200/50 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {members?.length || 0} member{members?.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {members?.map((member) => {
            const user = getUserById(member.userId);
            const isCurrentUser = member.userId === currentUserId;

            return (
              <div
                key={member.userId}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  isCurrentUser ? 'bg-indigo-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {(user?.name || user?.email || '?')[0].toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {user?.name || 'Unnamed User'}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    
                    {/* Role Badge */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {getRoleIcon(member.role)}
                      <span className={`text-xs font-medium ${
                        member.role === 'OWNER' ? 'text-yellow-700' :
                        member.role === 'ADMIN' ? 'text-indigo-700' :
                        'text-gray-600'
                      }`}>
                        {getRoleLabel(member.role)}
                      </span>
                    </div>

                    {/* Join Date */}
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!members?.length && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <UserIcon className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No members yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add members to collaborate
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
