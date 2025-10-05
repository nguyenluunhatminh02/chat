import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pinsApi from '../lib/pins';

export function useAddPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => pinsApi.addPin(messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pins'] });
    },
  });
}

export function useRemovePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => pinsApi.removePin(messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pins'] });
    },
  });
}

export function usePins(conversationId: string, params?: { limit?: number; cursor?: string }) {
  return useQuery({
    queryKey: ['pins', conversationId, params],
    queryFn: () => pinsApi.listPins({ conversationId, ...params }),
    enabled: !!conversationId,
  });
}
