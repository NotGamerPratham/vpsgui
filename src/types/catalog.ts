export type CatalogCategory = 'applications' | 'docker_images' | 'vm_images' | 'operating_systems' | 'plugins' | 'stacks' | 'templates';

export interface CatalogItem {
  id: string;
  name: string;
  category: CatalogCategory;
  version: string;
  description: string;
  iconName: string; // Lucide icon identifier
  publisher: string;
  official: boolean;
  downloadsCount: number;
  rating: number;
  tags: string[];
  readmeMarkdown?: string;
  defaultPorts?: number[];
  defaultEnv?: Record<string, string>;
}
