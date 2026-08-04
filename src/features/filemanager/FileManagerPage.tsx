import React, { useState, useEffect } from 'react';
import { FolderTree, FileText, Folder, Plus, Save, Upload, Search, ChevronRight, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { fileService } from '../../services/fileService';
import { FileItem } from '../../types/file';

export function FileManagerPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fileService.fetchFiles('/etc').then((res) => {
      setFiles(res);
      if (res.length > 0) {
        setSelectedFile(res[0]);
        setFileContent(res[0].content || '');
      }
    });
  }, []);

  const handleSelectFile = (file: FileItem) => {
    if (file.type === 'file') {
      setSelectedFile(file);
      setFileContent(file.content || '');
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload File</span>
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs bg-primary">
            {saved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
            <span>{saved ? 'Saved!' : 'Save File'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Left Directory Tree Panel */}
        <Card className="lg:col-span-1 bg-card/70 border-border/70 p-4 overflow-y-auto flex flex-col space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs font-bold text-foreground">
            <span>EXPLORER (/etc)</span>
            <Plus className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>

          <div className="space-y-1 font-mono text-xs">
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No files in directory</p>
            ) : (
              files.map((item) => {
                const isSelected = selectedFile?.path === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelectFile(item)}
                    className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left transition-colors ${
                      isSelected ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {item.type === 'directory' ? (
                      <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Editor Code View Panel */}
        <Card className="lg:col-span-3 bg-card/70 border-border/70 flex flex-col overflow-hidden">
          {/* File Header Bar */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs font-mono">
            <span className="text-foreground font-semibold">{selectedFile?.path || 'No file selected'}</span>
            {selectedFile && <span className="text-muted-foreground">{selectedFile.permissions} ({selectedFile.owner}:{selectedFile.group})</span>}
          </div>

          {/* Text Editor TextArea */}
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            placeholder="Select a file to edit..."
            className="flex-1 w-full bg-slate-950 p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </Card>
      </div>
    </div>
  );
}
