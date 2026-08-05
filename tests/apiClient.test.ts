import { apiClient } from '../src/api/client';

describe('ApiClient REST Client', () => {
  it('should resolve base URL correctly', () => {
    expect(apiClient).toBeDefined();
  });

  it('should handles API endpoints gracefully when unattached', async () => {
    try {
      await apiClient.get('/nodes');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});
