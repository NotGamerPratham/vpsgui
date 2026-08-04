export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  publisher: string;
  entry: string;
  permissions: ('docker' | 'terminal' | 'filesystem' | 'network' | 'telemetry')[];
  iconName: string;
  homepage?: string;
  repository?: string;
}

export interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  enabled: boolean;
  installedAt: string;
  status: 'active' | 'updating' | 'error' | 'disabled';
}
