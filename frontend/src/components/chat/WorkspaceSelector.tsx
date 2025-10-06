import { useState } from 'react';
import { Check, Users } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace, useWorkspaceMembers } from '../../hooks/useWorkspaces';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { AddMemberModal } from './AddMemberModal';
import { WorkspaceMembersPanel } from './WorkspaceMembersPanel';
import { toast } from 'react-hot-toast';

export function WorkspaceSelector() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const createMutation = useCreateWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newName, setNewName] = useState('');
  
  const currentWorkspaceId = localStorage.getItem('x-workspace-id') || 'ws_default';
  const { data: currentMembers } = useWorkspaceMembers(currentWorkspaceId);

  const handleSelect = (workspaceId: string) => {
    localStorage.setItem('x-workspace-id', workspaceId);
    window.location.reload(); // Reload to apply workspace filter
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }
    try {
      const ws = await createMutation.mutateAsync(newName.trim());
      toast.success(`Workspace "${newName.trim()}" created!`);
      setNewName('');
      setShowCreate(false);
      handleSelect(ws.id);
    } catch (error) {
      console.error('Failed to create workspace:', error);
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message 
        || (error as Error)?.message 
        || 'Failed to create workspace';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b bg-gray-50">
        <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Workspace
          </span>
          <Button
            onClick={() => setShowCreate(true)}
            className="text-xs px-2 py-1 h-auto"
            variant="ghost"
          >
            + New
          </Button>
        </div>
        
        <div className="space-y-1">
          {workspaces?.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between ${
                ws.id === currentWorkspaceId
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-white/70 text-gray-700'
              }`}
            >
              <span className="font-medium truncate">{ws.name}</span>
              {ws.id === currentWorkspaceId && <Check className="w-4 h-4 flex-shrink-0 ml-2" />}
            </button>
          ))}
        </div>

        {/* Current Workspace Info */}
        {currentMembers && (
          <div className="mt-3 pt-3 border-t border-indigo-200/50 space-y-2">
            <button
              onClick={() => setShowMembers(true)}
              className="w-full flex items-center justify-between text-xs hover:bg-white/50 px-2 py-1.5 rounded transition-colors"
            >
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="w-3.5 h-3.5" />
                <span>{currentMembers.length} member{currentMembers.length !== 1 ? 's' : ''}</span>
              </div>
              <span className="text-indigo-600 font-medium">View →</span>
            </button>
            <Button
              onClick={() => setShowAddMember(true)}
              className="w-full text-xs h-7 text-indigo-600 hover:text-indigo-700"
              variant="ghost"
            >
              + Add Member
            </Button>
          </div>
        )}

        {!workspaces?.length && (
          <div className="text-sm text-gray-500 text-center py-4">
            No workspaces yet
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Workspace Name
              </label>
              <Input
                placeholder="e.g., Marketing Team, Engineering"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="w-full"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowCreate(false);
                  setNewName('');
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!newName.trim() || createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <AddMemberModal
        workspaceId={currentWorkspaceId}
        open={showAddMember}
        onOpenChange={setShowAddMember}
      />

      {/* Members Panel */}
      {showMembers && (
        <WorkspaceMembersPanel
          workspaceId={currentWorkspaceId}
          onClose={() => setShowMembers(false)}
        />
      )}
    </>
  );
}
