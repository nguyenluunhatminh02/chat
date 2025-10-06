import { useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { useCreateConversation } from '../../hooks/useConversations';
import { useAppContext } from '../../hooks/useAppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X } from 'lucide-react';
import type { User } from '../../types';
import { toast } from 'react-hot-toast';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupModal({ open, onOpenChange }: CreateGroupModalProps) {
  const { data: allUsers } = useUsers();
  const { currentUserId } = useAppContext();
  const createMutation = useCreateConversation();
  
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Filter out current user and filter by search
  const availableUsers = (allUsers as User[])?.filter(u => u.id !== currentUserId) || [];
  const filteredUsers = availableUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedUserIds.size === 0) {
      toast.error('Please select at least one member');
      return;
    }
    
    try {
      await createMutation.mutateAsync({
        type: 'GROUP',
        title: groupName.trim(),
        members: Array.from(selectedUserIds),
      });
      
      toast.success(`Group "${groupName.trim()}" created successfully!`);
      
      // Reset and close
      setGroupName('');
      setSelectedUserIds(new Set());
      setSearchQuery('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to create group:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to create group';
      toast.error(message);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedUserIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  const selectedUsers = availableUsers.filter(u => selectedUserIds.has(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-[550px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Create Group Conversation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4 flex-1 overflow-hidden flex flex-col">
          {/* Group Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Group Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Marketing Team, Project Alpha"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
              className="w-full"
            />
          </div>

          {/* Selected Members Pills */}
          {selectedUserIds.size > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              {selectedUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-indigo-300 text-sm"
                >
                  <span className="font-medium text-gray-700 truncate max-w-[150px]">
                    {user.name || user.email}
                  </span>
                  <button
                    onClick={() => toggleUser(user.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Users */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Add Members <span className="text-red-500">*</span> ({selectedUserIds.size} selected)
            </label>
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* User List */}
          <div className="border rounded-lg flex-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.has(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
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

                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button 
              variant="ghost" 
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!groupName.trim() || selectedUserIds.size === 0 || createMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {createMutation.isPending ? 'Creating...' : `Create Group (${selectedUserIds.size} members)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
