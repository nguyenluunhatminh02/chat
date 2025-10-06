import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as workspacesApi from '../lib/workspaces';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.getMyWorkspaces(),
    staleTime: 5 * 60 * 1000, // 5min
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workspacesApi.createWorkspace(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useAddWorkspaceMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ 
      workspaceId, 
      userId, 
      role 
    }: { 
      workspaceId: string; 
      userId: string; 
      role?: 'MEMBER' | 'ADMIN' 
    }) => workspacesApi.addWorkspaceMember(workspaceId, userId, role),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['workspace-members', variables.workspaceId] });
    },
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
  });
}
