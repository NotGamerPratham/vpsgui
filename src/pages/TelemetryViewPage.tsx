/**
 * TelemetryViewPage Component
 * 
 * Top-level page wrapper for real-time infrastructure telemetry, CPU/RAM/Disk metric streaming,
 * and system process monitoring. Communicates directly with vpsgui-agent daemon on port 46509.
 * 
 * @module pages/TelemetryViewPage
 */

import React from 'react';
import { MonitoringPage } from '../features/monitoring/MonitoringPage';

export function TelemetryViewPage() {
  return <MonitoringPage />;
}

export default TelemetryViewPage;
