import { CatalogItem } from '../types/catalog';
import { apiClient } from '../api/client';

class CatalogService {
  async fetchCatalog(): Promise<CatalogItem[]> {
    try {
      return await apiClient.get<CatalogItem[]>('/catalog');
    } catch (e) {
      return [
        { id: 'cat-1', name: 'Nginx Proxy Manager', category: 'applications', version: 'v2.11.1', description: 'Docker container for managing Nginx proxy hosts with inline SSL certificate creation.', iconName: 'Globe', publisher: 'Nginx Proxy Manager Team', official: true, downloadsCount: 48200, rating: 4.9, tags: ['proxy', 'nginx', 'ssl', 'docker'] },
        { id: 'cat-2', name: 'PostgreSQL Database Stack', category: 'stacks', version: 'v16.2', description: 'High-availability PostgreSQL cluster stack pre-configured with pgAdmin and automated daily backups.', iconName: 'Database', publisher: 'VPSGUI Team', official: true, downloadsCount: 31400, rating: 4.8, tags: ['database', 'postgres', 'ha', 'backup'] },
        { id: 'cat-3', name: 'Redis In-Memory Cache', category: 'docker_images', version: 'v7.2.4', description: 'Key-value database and cache cluster template.', iconName: 'Zap', publisher: 'Redis Labs', official: true, downloadsCount: 92000, rating: 4.9, tags: ['cache', 'redis', 'nosql'] },
        { id: 'cat-4', name: 'WordPress + MySQL Stack', category: 'templates', version: 'v6.5', description: '1-Click deployment for production WordPress website with FastCGI caching.', iconName: 'Layout', publisher: 'VPSGUI Team', official: true, downloadsCount: 18500, rating: 4.7, tags: ['cms', 'wordpress', 'mysql', 'php'] },
      ];
    }
  }
}

export const catalogService = new CatalogService();
