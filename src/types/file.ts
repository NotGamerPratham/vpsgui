export interface FileItem {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory' | 'symlink';
  extension?: string;
  permissions: string;
  owner: string;
  group: string;
  modifiedAt: string;
  content?: string;
}

export interface FileEditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}
