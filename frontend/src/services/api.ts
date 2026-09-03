import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const SourcesApi = {
  list: async () => (await apiClient.get('/api/v1/sources')).data,
  register: async (data: any) => (await apiClient.post('/api/v1/sources', data)).data,
  test: async (sourceId: string) => (await apiClient.post(`/api/v1/sources/${sourceId}/test`)).data,
  discover: async (sourceId: string) => (await apiClient.post(`/api/v1/sources/${sourceId}/discover`)).data,
  saveSelection: async (sourceId: string, selection: any) => (await apiClient.put(`/api/v1/sources/${sourceId}/selection`, { selection })).data,
  collect: async (sourceId: string) => (await apiClient.post(`/api/v1/sources/${sourceId}/runs`)).data,
  listRuns: async (sourceId?: string) => {
    if (sourceId && sourceId.trim() !== '') {
      return (await apiClient.get(`/api/v1/sources/${sourceId}/runs`)).data;
    }
    return (await apiClient.get('/api/v1/collection-runs')).data;
  },
  autoSync: async (sourceId: string, enabled: boolean, intervalSeconds = 30) => (await apiClient.patch(`/api/v1/sources/${sourceId}/auto-sync`, { enabled, intervalSeconds })).data,
  getRun: async (runId: string) => (await apiClient.get(`/api/v1/collection-runs/${runId}`)).data,
  previewRecords: async (runId: string, page = 1, pageSize = 20) => (await apiClient.get(`/api/v1/collection-runs/${runId}/records?page=${page}&pageSize=${pageSize}`)).data,
};

export const ProductionApi = {
  getLines: async () => (await apiClient.get('/api/v1/production-lines')).data,
  getBatch: async (batchId: string) => (await apiClient.get(`/api/v1/batches/${batchId}`)).data,
  getProvenance: async (batchId: string) => (await apiClient.get(`/api/v1/batches/${batchId}/provenance`)).data,
  blockBatch: async (batchId: string, reason: string) => (await apiClient.post(`/api/v1/batches/${batchId}/management-events/blocks`, { reason })).data,
  resumeBatch: async (batchId: string, note?: string) => (await apiClient.post(`/api/v1/batches/${batchId}/management-events/resumes`, { note })).data,
  acknowledgeException: async (batchId: string, exceptionKey: string, note?: string) => (await apiClient.post(`/api/v1/batches/${batchId}/management-events/acknowledgements`, { exceptionKey, note })).data,
  addNote: async (batchId: string, note: string) => (await apiClient.post(`/api/v1/batches/${batchId}/management-events/notes`, { note })).data,
  getStaleThreshold: async () => (await apiClient.get('/api/v1/settings/stale-threshold')).data,
  updateStaleThreshold: async (minutes: number) => (await apiClient.put('/api/v1/settings/stale-threshold', { minutes })).data,
};
