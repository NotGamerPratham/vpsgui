import { CatalogItem } from '../types/catalog';
import { apiClient } from '../api/client';

class CatalogService {
  async fetchCatalog(): Promise<CatalogItem[]> {
    try {
      return await apiClient.get<CatalogItem[]>('/catalog');
    } catch (e) {
      return [];
    }
  }
}

export const catalogService = new CatalogService();
