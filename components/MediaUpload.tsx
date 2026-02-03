import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, Video, Link, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  onUrl: (url: string) => void;
  onFile: (files: File[]) => void;
  mode: 'file' | 'url';
}

export default function MediaUpload({ onUrl, onFile, mode }: Props) {
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    multiple: true,
    maxFiles: 10,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFilesSelect(acceptedFiles);
      }
    }
  });

  const handleFilesSelect = (files: File[]) => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(files);
    setMediaUrl('');
    onFile(files);
    onUrl('');
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(previews);
  };

  const handleUrlChange = (url: string) => {
    setMediaUrl(url);
    setSelectedFiles([]);
    onUrl(url);
    onFile([]);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(newFiles);
    setPreviewUrls(newPreviews);
    onFile(newFiles);
  };

  const clearMedia = () => {
    setSelectedFiles([]);
    setMediaUrl('');
    onFile([]);
    onUrl('');
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
  };

  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  return (
    <div>
      {mode === 'file' ? (
        <div>
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              relative rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/10' 
                : selectedFiles.length > 0 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border hover:border-muted-foreground'
              }
            `}
          >
            <input {...getInputProps()} />
            
            {selectedFiles.length > 0 ? (
              <div>
                <p className="font-medium mb-4">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </p>
                
                {/* Files Preview */}
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {previewUrls[index] && (
                        <div className="w-20 h-20 rounded-md overflow-hidden bg-secondary">
                          {file.type.startsWith('video/') ? (
                            <video src={previewUrls[index]} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={previewUrls[index]} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={(e) => { e.stopPropagation(); clearMedia(); }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            ) : (
              <div>
                <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-medium mb-1">
                  {isDragActive ? 'Drop files here' : 'Upload media files'}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Drag & drop or click to select
                </p>
                <div className="flex justify-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="w-3 h-3" /> Images
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3 h-3" /> Videos
                  </span>
                  <span>Max 10 files</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* URL Input */
        <div className="space-y-3">
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Paste image or link URL..."
              value={mediaUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="pl-10"
            />
            {mediaUrl && (
              <button
                onClick={clearMedia}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {mediaUrl && (
            <div className="p-3 rounded-md bg-secondary/50 text-sm">
              <p className="text-muted-foreground truncate">{mediaUrl}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
