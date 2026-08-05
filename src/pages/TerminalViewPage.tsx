/**
 * TerminalViewPage Component
 * 
 * Top-level page wrapper for SSH Workbench & Terminal emulator interface.
 * Allows executing remote Linux shell commands, running script snippets, and inspecting output logs.
 * 
 * @module pages/TerminalViewPage
 */

import React from 'react';
import { TerminalPage } from '../features/terminal/TerminalPage';

export function TerminalViewPage() {
  return <TerminalPage />;
}

export default TerminalViewPage;
