import React, { useState, useEffect, useCallback } from 'react';
import { FolderTree, FileText, Folder, Link2, Save, ChevronLeft, Check, AlertCircle, Loader2, RefreshCw, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { fileService } from '../../services/fileService';
import { FileItem } from '../../types/file';

/** Walk one level up, handling both POSIX and Windows separators. */
function parentPath(currentPath: string): string {
  const trimmed = currentPath.replace(/[\\/]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (idx < 0) return trimmed;
  if (idx === 0) return '/';
  const parent = trimmed.slice(0, idx);
  // "C:" -> "C:\" so a Windows drive root stays a valid directory.
  return /^[a-zA-Z]:$/.test(parent) ? `${parent}\\` : parent;
}

/** Join a name onto a directory path without doubling the separator. */
function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

// With the whole filesystem browsable, start at the root rather than an arbitrary subdirectory.
const DEFAULT_PATH = '/';

export function FileManagerPage() {
  const [currentPath, setCurrentPath] = useState(DEFAULT_PATH);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (targetPath: string) => {
    setListLoading(true);
    const { items, error } = await fileService.fetchFiles(targetPath);
    setFiles(items);
    setListError(error);
    setListLoading(false);
    // Do not auto-open a file: opening now costs a separate read request, and silently loading an
    // arbitrary file into a save-capable editor invites accidental overwrites.
    setSelectedFile(null);
    setFileContent('');
    setIsDirty(false);
    setIsTruncated(false);
    setFileError(null);
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const handleSelectFile = async (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path);
      return;
    }
    if (isDirty && !window.confirm('Discard unsaved changes to the current file?')) return;

    setSelectedFile(file);
    setFileLoading(true);
    setFileError(null);
    setIsDirty(false);
    try {
      // Fetch the full contents on demand rather than relying on a prefix embedded in the listing.
      const result = await fileService.readFile(file.path);
      setFileContent(result.content);
      setIsTruncated(result.truncated);
    } catch (e) {
      setFileContent('');
      setIsTruncated(false);
      setFileError(e instanceof Error ? e.message : 'Failed to read file');
    } finally {
      setFileLoading(false);
    }
  };

  /** Create a new empty file in the current directory. */
  const handleNewFile = async () => {
    const name = window.prompt('New file name:');
    if (!name?.trim()) return;
    setActionError(null);
    const target = joinPath(currentPath, name.trim());
    const result = await fileService.writeFile(target, '');
    if (result.success) await loadDirectory(currentPath);
    else setActionError(result.error || 'Could not create the file');
  };

  /** Create a new directory in the current directory. */
  const handleNewFolder = async () => {
    const name = window.prompt('New folder name:');
    if (!name?.trim()) return;
    setActionError(null);
    const target = joinPath(currentPath, name.trim());
    const result = await fileService.createDirectory(target);
    if (result.success) await loadDirectory(currentPath);
    else setActionError(result.error || 'Could not create the folder');
  };

  const handleRename = async (item: FileItem) => {
    const name = window.prompt(`Rename "${item.name}" to:`, item.name);
    if (!name?.trim() || name.trim() === item.name) return;
    setActionError(null);
    const target = joinPath(currentPath, name.trim());
    const result = await fileService.renamePath(item.path, target);
    if (result.success) await loadDirectory(currentPath);
    else setActionError(result.error || 'Could not rename');
  };

  const handleDelete = async (item: FileItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setActionError(null);

    let result = await fileService.deletePath(item.path, false);
    // The agent refuses a non-empty directory unless recursion is explicitly requested, so ask
    // rather than defaulting to a recursive wipe.
    if (!result.success && /not empty/i.test(result.error || '')) {
      if (!window.confirm(`"${item.name}" is not empty. Delete it and everything inside?`)) return;
      result = await fileService.deletePath(item.path, true);
    }

    if (result.success) {
      if (selectedFile?.path === item.path) {
        setSelectedFile(null);
        setFileContent('');
        setIsDirty(false);
      }
      await loadDirectory(currentPath);
    } else {
      setActionError(result.error || 'Could not delete');
    }
  };

  const canSave = Boolean(selectedFile) && !fileLoading && !isTruncated && !fileError && saveState !== 'saving';

  const handleSave = async () => {
    // Refuse to write back a partially loaded file — that would truncate it on disk.
    if (!selectedFile || !canSave) return;
    setSaveState('saving');
    setSaveError(null);
    const result = await fileService.writeFile(selectedFile.path, fileContent);
    if (result.success) {
      setSaveState('saved');
      setIsDirty(false);
    } else {
      setSaveState('error');
      setSaveError(result.error || 'Save failed');
    }
    setTimeout(() => setSaveState('idle'), 2500);
  };

  // Warn before a tab close or reload drops unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <span>VS Code File Explorer (VPS Filesystem)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse host node file tree, edit server config files, and manage directory permissions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={handleNewFile} className="gap-1.5 text-xs">
            <FilePlus className="h-3.5 w-3.5" />
            <span>New file</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleNewFolder} className="gap-1.5 text-xs">
            <FolderPlus className="h-3.5 w-3.5" />
            <span>New folder</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => loadDirectory(currentPath)} disabled={listLoading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave} className="gap-1.5 text-xs bg-primary">
            {saveState === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === 'saved' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : saveState === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>
              {saveState === 'saving'
                ? 'Saving...'
                : saveState === 'saved'
                ? 'Saved!'
                : saveState === 'error'
                ? 'Save Failed'
                : `Save File${isDirty ? ' *' : ''}`}
            </span>
          </Button>
        </div>
      </div>

      {(listError || saveError || fileError || actionError) && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{listError || fileError || saveError || actionError}</span>
        </div>
      )}

      {isTruncated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            This file is too large to load fully. A preview is shown and saving is disabled, so the
            file on disk cannot be overwritten with a partial copy.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Left Directory Tree Panel */}
        <Card className="lg:col-span-1 bg-card/70 border-border/70 p-4 overflow-y-auto flex flex-col space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs font-bold text-foreground">
            <span className="truncate" title={currentPath}>EXPLORER ({currentPath})</span>
            {listLoading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />}
          </div>

          <div className="space-y-1 font-mono text-xs">
            <button
              onClick={() => setCurrentPath(parentPath(currentPath))}
              disabled={parentPath(currentPath) === currentPath}
              className="flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">.. (up)</span>
            </button>

            {listLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
            ) : files.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {listError ? 'Directory unavailable' : 'Empty directory'}
              </p>
            ) : (
              files.map((item) => {
                const isSelected = selectedFile?.path === item.path;
                return (
                  <div key={item.path} className="group flex items-center gap-1">
                  <button
                    onClick={() => handleSelectFile(item)}
                    disabled={item.readable === false}
                    title={item.readable === false ? 'Blocked by the agent (credential file)' : item.path}
                    className={`flex flex-1 min-w-0 items-center space-x-2 rounded px-2 py-1 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {item.type === 'directory' ? (
                      <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : item.type === 'symlink' ? (
                      <Link2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>

                  {/* Revealed on hover so the tree stays readable; both call real agent endpoints. */}
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleRename(item)}
                      title={`Rename ${item.name}`}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title={`Delete ${item.name}`}
                      className="rounded p-1 text-muted-foreground hover:text-rose-400 hover:bg-muted/60"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Editor Code View Panel */}
        <Card className="lg:col-span-3 bg-card/70 border-border/70 flex flex-col overflow-hidden">
          {/* File Header Bar */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs font-mono gap-4">
            <span className="text-foreground font-semibold truncate" title={selectedFile?.path}>
              {selectedFile?.path || 'No file selected'}
              {isDirty && <span className="text-amber-400 ml-1">(unsaved)</span>}
            </span>
            {/* Only render metadata the agent actually reports, instead of "undefined (undefined:undefined)". */}
            {selectedFile && (
              <span className="text-muted-foreground shrink-0">
                {[selectedFile.permissions, selectedFile.owner && `${selectedFile.owner}:${selectedFile.group}`]
                  .filter(Boolean)
                  .join(' ')}
              </span>
            )}
          </div>

          {/* Text Editor TextArea */}
          <textarea
            value={fileContent}
            onChange={(e) => {
              setFileContent(e.target.value);
              setIsDirty(true);
            }}
            readOnly={!selectedFile || fileLoading || isTruncated}
            placeholder={fileLoading ? 'Loading file...' : 'Select a file to edit...'}
            className="flex-1 w-full bg-slate-950 p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed read-only:text-emerald-400/60"
            spellCheck={false}
          />
        </Card>
      </div>
    </div>
  );
}
