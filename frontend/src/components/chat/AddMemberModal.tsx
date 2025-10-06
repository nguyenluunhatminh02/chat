import { useState } from 'react';
import { useAddWorkspaceMember, useWorkspaceMembers } from '../../hooks/useWorkspaces';
import { useUsers } from '../../hooks/useUsers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { User } from '../../types';
import { toast } from 'react-hot-toast';

interface AddMemberModalProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberModal({ workspaceId, open, onOpenChange }: AddMemberModalProps) {
  const { data: allUsers } = useUsers();
  const { data: members } = useWorkspaceMembers(workspaceId);
  const addMemberMutation = useAddWorkspaceMember();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');

  // Filter out users who are already members
  const memberUserIds = new Set(members?.map(m => m.userId) || []);
  const availableUsers = (allUsers as User[])?.filter(u => !memberUserIds.has(u.id)) || [];
  
  // Filter by search query
  const filteredUsers = availableUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    
    try {
      await addMemberMutation.mutateAsync({
        workspaceId,
        userId: selectedUserId,
        role: selectedRole,
      });
      
      toast.success(`Member added as ${selectedRole}`);
      
      // Reset and close
      setSelectedUserId(null);
      setSearchQuery('');
      setSelectedRole('MEMBER');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add member:', error);
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message 
        || (error as Error)?.message 
        || 'Failed to add member';
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Add Member to Workspace</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Search Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Search Users
            </label>
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full"
            />
          </div>

          {/* User List */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No users found' : 'No available users to add'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                      selectedUserId === user.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {user.name || 'Unnamed User'}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {user.email}
                        </div>
                      </div>

                      {/* Check Icon */}
                      {selectedUserId === user.id && (
                        <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Selection */}
          {selectedUserId && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Role
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRole('MEMBER')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedRole === 'MEMBER'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">Member</div>
                  <div className="text-xs text-gray-500">Can view and participate</div>
                </button>
                <button
                  onClick={() => setSelectedRole('ADMIN')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedRole === 'ADMIN'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">Admin</div>
                  <div className="text-xs text-gray-500">Can add members</div>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button 
              variant="ghost" 
              onClick={() => {
                onOpenChange(false);
                setSelectedUserId(null);
                setSearchQuery('');
                setSelectedRole('MEMBER');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={!selectedUserId || addMemberMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
