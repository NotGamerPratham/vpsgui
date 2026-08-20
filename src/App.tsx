import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LinuxOnlyGuard } from './components/common/LinuxOnlyGuard';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ServersPage } from './features/infrastructure/ServersPage';
import { MultiVPSPage } from './features/multivps/MultiVPSPage';
import { InfrastructureMapPage as TopologyMapPage } from './features/map/InfrastructureMapPage';
import { DockerContainersPage } from './features/docker/DockerContainersPage';
import { DockerImagesPage } from './features/docker/DockerImagesPage';
import { FileManagerPage } from './features/filemanager/FileManagerPage';
import { TerminalPage } from './features/terminal/TerminalPage';
import { MonitoringPage } from './features/monitoring/MonitoringPage';
import { HealthMatrixPage } from './features/health/HealthMatrixPage';
import { DiagnosticsPage } from './features/diagnostics/DiagnosticsPage';
import { StorageManagerPage } from './features/storage/StorageManagerPage';
import { NetworkManagerPage } from './features/network/NetworkManagerPage';
import { FirewallPage } from './features/security/FirewallPage';
import { SshKeysPage } from './features/security/SshKeysPage';
import { UsersPage } from './features/security/UsersPage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { SecretsPage } from './features/secrets/SecretsPage';
import { IacPage } from './features/iac/IacPage';
import { AutomationPage } from './features/automation/AutomationPage';
import { JobQueuePage } from './features/queue/JobQueuePage';
import { AuditCenterPage } from './features/audit/AuditCenterPage';
import { SpotlightExplorerPage } from './features/explorer/SpotlightExplorerPage';
import { AgentPage } from './features/agent/AgentPage';
import { DeploymentsPage } from './features/deployments/DeploymentsPage';
import { ReverseProxyPage } from './features/proxy/ReverseProxyPage';
import { DatabasesPage } from './features/databases/DatabasesPage';
import { BackupsPage } from './features/backups/BackupsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { AuthPage } from './auth/AuthPage';
import { DocsPage } from './features/docs/DocsPage';
import { PackagesPage } from './features/system/PackagesPage';
import { ServicesPage } from './features/system/ServicesPage';

// The QueryClient lives in main.tsx. A second provider here shadowed it with a conflicting config,
// so components resolved against a different cache than the one the app was configured with.
export function App() {
  return (
    <LinuxOnlyGuard>
        <BrowserRouter>
          <Routes>
            {/* The landing page used to own "/". With it gone the bare domain fell
                through to the catch-all and rendered a 404, so the root now sends
                visitors to the dashboard; ProtectedRoute bounces them to /login
                if they are not signed in. */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />

            {/* Protected Authenticated Infrastructure Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/servers" element={<ServersPage />} />
                <Route path="/packages" element={<PackagesPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/multivps" element={<MultiVPSPage />} />
                <Route path="/topology" element={<TopologyMapPage />} />
                <Route path="/docker/containers" element={<DockerContainersPage />} />
                <Route path="/docker/images" element={<DockerImagesPage />} />
                <Route path="/files" element={<FileManagerPage />} />
                {/* CategoryNavigation links here; alias kept so both paths and existing bookmarks work. */}
                <Route path="/file-manager" element={<FileManagerPage />} />
                <Route path="/terminal" element={<TerminalPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/health" element={<HealthMatrixPage />} />
                <Route path="/diagnostics" element={<DiagnosticsPage />} />
                <Route path="/disks" element={<StorageManagerPage />} />
                <Route path="/network" element={<NetworkManagerPage />} />
                <Route path="/firewall" element={<FirewallPage />} />
                <Route path="/security/firewall" element={<FirewallPage />} />
                <Route path="/ssh-keys" element={<SshKeysPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/catalog" element={<CatalogPage />} />
                <Route path="/secrets" element={<SecretsPage />} />
                <Route path="/iac" element={<IacPage />} />
                <Route path="/automation" element={<AutomationPage />} />
                <Route path="/automation/workflows" element={<AutomationPage />} />
                <Route path="/queue" element={<JobQueuePage />} />
                <Route path="/audit" element={<AuditCenterPage />} />
                <Route path="/spotlight" element={<SpotlightExplorerPage />} />
                <Route path="/agent" element={<AgentPage />} />
                <Route path="/deployments" element={<DeploymentsPage />} />
                <Route path="/proxy" element={<ReverseProxyPage />} />
                <Route path="/databases" element={<DatabasesPage />} />
                <Route path="/backups" element={<BackupsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/docs" element={<DocsPage />} />
              </Route>
            </Route>

            {/* Catch-all: unknown URLs previously rendered a blank page. */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
    </LinuxOnlyGuard>
  );
}

export default App;
