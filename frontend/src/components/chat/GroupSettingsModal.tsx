import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Upload, Users, UserMinus, UserPlus, Search } from 'lucide-react';
import type { Conversation, User } from '../../types';
import { toast } from 'react-hot-toast';
import * as api from '../../lib/api';
import { useUsers } from '../../hooks';

interface GroupSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  getUserById: (userId: string) => User | undefined;
  currentUserId: string;
  onUpdateGroup?: (data: { title?: string; avatarUrl?: string }) => Promise<void>;
}

export function GroupSettingsModal({
  open,
  onOpenChange,
  conversation,
  getUserById,
  currentUserId,
  onUpdateGroup,
}: GroupSettingsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    conversation.avatarUrl || null
  );
  const [title, setTitle] = useState(conversation.title || '');
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Fetch workspace members
  const { data: allUsers = [] } = useUsers();

  // Filter available users (not already in conversation)
  const availableUsers = (allUsers as User[]).filter(
    (user: User) => !conversation.members.some((m) => m.userId === user.id)
  );

  // Filter by search query
  const filteredUsers = availableUsers.filter((user: User) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q)
    );
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/conversations/${conversation.id}/avatar`,
        {
          method: 'POST',
          headers: {
            'X-User-Id': currentUserId,
            'X-Workspace-Id': localStorage.getItem('x-workspace-id') || 'ws_default',
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const result = await response.json();
      toast.success('Avatar updated successfully!');

      // ✅ Refresh will happen automatically via WebSocket event 'conversation.updated'
      // Backend emits this event with avatarKey, ChatPage listens and invalidates queries
      // No need to manually invalidate here!
      
      // Optional: Update parent component if callback provided
      if (onUpdateGroup) {
        await onUpdateGroup({ avatarUrl: result.avatarUrl });
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
      setAvatarPreview(conversation.avatarUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      if (onUpdateGroup) {
        await onUpdateGroup({ title: title.trim() });
        toast.success('Group updated successfully!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to update group:', error);
      toast.error('Failed to update group');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const workspaceId = localStorage.getItem('x-workspace-id') || 'ws_default';
      await api.removeMemberFromConversation(currentUserId, conversation.id, memberId, workspaceId);
      toast.success('Member removed successfully!');
      
      // ✅ Refresh will happen automatically via WebSocket event 'member.removed'
      // ChatPage listens to this event and invalidates queries
      // No need to manually invalidate here!
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleAddMember = async (newMemberId: string) => {
    if (conversation.members.some(m => m.userId === newMemberId)) {
      toast.error('User is already a member');
      return;
    }

    try {
      setAddingMember(true);
      const workspaceId = localStorage.getItem('x-workspace-id') || 'ws_default';
      await api.addMemberToConversation(currentUserId, conversation.id, newMemberId, workspaceId);
      toast.success('Member added successfully!');
      setShowAddMember(false);
      setSearchQuery('');
      
      // ✅ Refresh will happen automatically via WebSocket event 'member.added'
      // ChatPage listens to this event and invalidates queries
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const isOwner = conversation.members.find(
    (m) => m.userId === currentUserId && m.role === 'OWNER'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Group Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4 flex-1 overflow-y-auto">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-3xl overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Group avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{title[0]?.toUpperCase() || 'G'}</span>
                )}
              </div>
              {isOwner && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg"
                >
                  <Upload className="w-4 h-4 text-white" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            {uploading && (
              <div className="text-sm text-gray-600">Uploading...</div>
            )}
          </div>

          {/* Group Name */}
          {isOwner ? (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Group Name
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter group name"
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Group Name
              </label>
              <div className="text-lg font-semibold text-gray-900">{title}</div>
            </div>
          )}

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Members ({conversation.members.length})
              </label>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Member
                </Button>
              )}
            </div>

            {/* Add Member Interface */}
            {showAddMember && isOwner && (
              <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="pl-10"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {!filteredUsers || filteredUsers.length === 0 ? (
                    <div className="text-xs text-gray-500 italic p-2">
                      {searchQuery.trim() ? 'No users found' : 'All workspace members are already in this group'}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddMember(user.id)}
                        disabled={addingMember}
                        className="w-full flex items-center gap-2 p-2 hover:bg-white rounded transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {user.name || 'Unknown User'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
              {conversation.members.map((member) => {
                const user = getUserById(member.userId);
                return (
                  <div
                    key={member.id}
                    className="p-3 flex items-center gap-3 hover:bg-gray-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {(user?.name || member.userId)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {user?.name || 'Unknown User'}
                        {member.userId === currentUserId && (
                          <span className="text-indigo-600 ml-2">(You)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {user?.email || member.userId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'OWNER' ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                          Owner
                        </span>
                      ) : (
                        isOwner && member.userId !== currentUserId && (
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                            title="Remove member"
                          >
                            <UserMinus className="w-4 h-4 text-red-600" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isOwner && (
            <Button onClick={handleSave} disabled={!title.trim()}>
              Save Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
