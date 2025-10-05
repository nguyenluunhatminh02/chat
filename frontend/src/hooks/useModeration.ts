import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as moderation from '../lib/moderation';

// ============ BLOCKS ============

export function useBlocks(userId: string) {
  return useQuery({
    queryKey: ['blocks', userId],
    queryFn: () => moderation.listBlocks(userId),
    enabled: !!userId,
  });
}

export function useBlockUser(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ blockedUserId, expiresAt }: { blockedUserId: string; expiresAt?: string }) =>
      moderation.blockUser(userId, blockedUserId, expiresAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] });
    },
  });
}

export function useUnblockUser(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (blockedUserId: string) => moderation.unblockUser(userId, blockedUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] });
    },
  });
}

// ============ REPORTS ============

export function useReports(isAdmin: boolean, status?: moderation.ReportStatus) {
  return useQuery({
    queryKey: ['reports', status],
    queryFn: () => moderation.listReports(isAdmin, status),
    enabled: isAdmin,
  });
}

export function useCreateReport(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      type: moderation.ReportType;
      targetMessageId?: string;
      targetUserId?: string;
      targetConversationId?: string;
      reason: moderation.ReportReason;
      details?: string;
    }) => moderation.createReport(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useResolveReport(adminUserId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ reportId, action, resolutionNotes }: {
      reportId: string;
      action?: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER';
      resolutionNotes?: string;
    }) => moderation.resolveReport(reportId, adminUserId, { action, resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// ============ GROUP MODERATION ============

export function useBans(userId: string, conversationId: string) {
  return useQuery({
    queryKey: ['bans', conversationId],
    queryFn: () => moderation.listBans(userId, conversationId),
    enabled: !!userId && !!conversationId,
  });
}

export function useKickMember(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ conversationId, targetUserId }: { conversationId: string; targetUserId: string }) =>
      moderation.kickMember(userId, conversationId, targetUserId),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'members'] });
    },
  });
}

export function useBanMember(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ conversationId, targetUserId, reason, expiresAt }: {
      conversationId: string;
      targetUserId: string;
      reason?: string;
      expiresAt?: string;
    }) => moderation.banMember(userId, conversationId, { userId: targetUserId, reason, expiresAt }),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['bans', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'members'] });
    },
  });
}

export function useUnbanMember(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ conversationId, targetUserId }: { conversationId: string; targetUserId: string }) =>
      moderation.unbanMember(userId, conversationId, targetUserId),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['bans', conversationId] });
    },
  });
}

// ============ APPEALS ============

export function useAppeals(isAdmin: boolean, status?: moderation.AppealStatus) {
  return useQuery({
    queryKey: ['appeals', status],
    queryFn: () => moderation.listAppeals(isAdmin, status),
    enabled: isAdmin,
  });
}

export function useCreateAppeal(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      reportId?: string;
      banId?: string;
      reason: string;
    }) => moderation.createAppeal(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
    },
  });
}

export function useReviewAppeal(adminUserId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ appealId, decision, reviewNotes }: {
      appealId: string;
      decision: 'APPROVED' | 'REJECTED';
      reviewNotes?: string;
    }) => moderation.reviewAppeal(appealId, adminUserId, decision, reviewNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
    },
  });
}
