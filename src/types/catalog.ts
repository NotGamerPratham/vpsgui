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
  /**
   * null: these would have to come from a registry the agent does not query. They were typed as
   * required numbers, so the UI called .toLocaleString() on them and would throw once the agent
   * started returning honest nulls instead of invented popularity figures.
   */
  downloadsCount: number | null;
  rating: number | null;
  tags: string[];
  /** Container image reference, for items deployable via Docker. */
  image?: string;
  /**
   * Ready-to-run command for items that are not a single container - OS
   * cloud images, VM appliances and multi-service stacks. Without it those
   * cards render a permanently disabled copy button.
   */
  installCommand?: string;
  readmeMarkdown?: string;
  defaultPorts?: number[];
  defaultEnv?: Record<string, string>;
}
