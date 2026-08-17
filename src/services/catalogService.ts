import { CatalogItem } from '../types/catalog';
import { apiClient } from '../api/client';

/**
 * NOTE: the bundled vpsgui-agent does not implement GET /catalog, so this always resolves to an
 * empty list today. It is kept as the integration point for a future catalog backend; the page
 * renders its empty state rather than inventing entries.
 */
class CatalogService {
  async fetchCatalog(): Promise<CatalogItem[]> {
    try {
      const res = await apiClient.get<CatalogItem[]>('/catalog');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }
}

export const catalogService = new CatalogService();
