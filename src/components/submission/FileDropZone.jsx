import { useRef, useState } from 'react';
import { Upload, CheckCircle2, X, FileArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FileDropZone({ onFileSelect, file, error }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/zip' && !selectedFile.name.endsWith('.zip')) {
      onFileSelect(null, 'Only ZIP files are accepted.');
      return;
    }
    onFileSelect(selectedFile, null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const borderClass = error
    ? 'border-destructive bg-destructive/5'
    : file
    ? 'border-primary bg-primary/5'
    : isDragging
    ? 'border-primary bg-primary/5'
    : 'border-border hover:border-primary/50 hover:bg-primary/5';

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${borderClass}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileArchive className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-medium text-foreground text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onFileSelect(null, null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : isDragging ? (
          <div className="space-y-2">
            <Upload className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium text-primary">Drop it here!</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">Drag & drop your ZIP file here</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <p className="text-xs text-muted-foreground/60">Maximum file size: 50 MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive mt-1.5">{error}</p>}
    </div>
  );
}