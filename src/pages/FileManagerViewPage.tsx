/**
 * FileManagerViewPage Component
 * 
 * Top-level page wrapper for VS Code style web file manager. Provides directory tree navigation,
 * file editing, permission inspection, and server file content saving over REST API endpoints.
 * 
 * @module pages/FileManagerViewPage
 */

import React from 'react';
import { FileManagerPage } from '../features/filemanager/FileManagerPage';

export function FileManagerViewPage() {
  return <FileManagerPage />;
}

export default FileManagerViewPage;
