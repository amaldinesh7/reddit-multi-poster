import React from 'react';
import NextImage from 'next/image';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, Image, Video, Link, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  onUrl: (url: string) => void;
  onFile: (files: File[]) => void;
  mode: 'image' | 'video' | 'url';
  resetSignal?: number;
}

export default function MediaUpload({ onUrl, onFile, mode, resetSignal }: Props) {
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [rejectionError, setRejectionError] = React.useState<string | null>(null);
  const previewUrlsRef = React.useRef<string[]>([]);
  const onFileRef = React.useRef(onFile);
  const onUrlRef = React.useRef(onUrl);

  const handleDropRejected = React.useCallback((fileRejections: FileRejection[]) => {
    const errors: string[] = [];
    
    fileRejections.forEach((rejection) => {
      rejection.errors.forEach((error) => {
        if (error.code === 'file-too-large') {
          errors.push('Too large. Max 25MB per file.');
        } else if (error.code === 'too-many-files') {
          errors.push(mode === 'video' ? 'Only 1 video allowed.' : 'Limit is 10 files. Remove some to add more.');
        } else if (error.code === 'file-invalid-type') {
          errors.push(mode === 'video' ? 'Only video files allowed.' : 'Only image files allowed.');
        } else {
          errors.push(error.message);
        }
      });
    });
    
    // Dedupe errors and show
    const uniqueErrors = [...new Set(errors)];
    setRejectionError(uniqueErrors.join('. '));
    
    // Auto-clear error after 5 seconds
    setTimeout(() => setRejectionError(null), 5000);
  }, [mode]);

  const acceptConfig = React.useMemo((): Record<string, string[]> => {
    if (mode === 'video') {
      return { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] };
    }
    return { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] };
  }, [mode]);

  const maxFiles = mode === 'video' ? 1 : 10;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptConfig,
    multiple: mode !== 'video',
    maxFiles,
    maxSize: 25 * 1024 * 1024, // 25MB
    onDrop: (acceptedFiles, fileRejections) => {
      setRejectionError(null);
      if (fileRejections.length > 0) {
        handleDropRejected(fileRejections);
        return;
      }
      if (acceptedFiles.length > 0) {
        handleFilesSelect(acceptedFiles);
      }
    },
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

  const clearMedia = React.useCallback(() => {
    setSelectedFiles([]);
    setMediaUrl('');
    onFileRef.current([]);
    onUrlRef.current('');
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
  }, []);

  React.useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  React.useEffect(() => {
    onFileRef.current = onFile;
    onUrlRef.current = onUrl;
  }, [onFile, onUrl]);

  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  React.useEffect(() => {
    if (resetSignal === undefined) return;
    clearMedia();
  }, [resetSignal]);

  return (
    <div>
      {mode !== 'url' ? (
        <div>
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              relative rounded-lg border-2 border-dashed p-4 sm:p-6 text-center cursor-pointer transition-colors
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
                <p className="text-sm font-medium mb-3">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                </p>

                {/* Files Preview */}
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {previewUrls[index] && (
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-secondary">
                          {file.type.startsWith('video/') ? (
                            <video src={previewUrls[index]} className="w-full h-full object-cover" muted />
                          ) : (
                            <NextImage src={previewUrls[index]} alt="" fill unoptimized className="object-cover" />
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); clearMedia(); }}
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Remove all
                </button>
              </div>
            ) : (
              <div>
                <Upload className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm sm:text-base font-medium mb-1">
                  {isDragActive ? 'Drop here' : mode === 'video' ? 'Drop a video here' : 'Drop images here'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  or click to choose
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                  {mode === 'video' ? (
                    <>
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" /> Video only
                      </span>
                      <span>1 file, 25MB max</span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <Image className="w-3 h-3" /> Images only
                      </span>
                      <span>Up to 10 files, 25MB each</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rejection Error Message */}
          {rejectionError && (
            <div className="mt-2 flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{rejectionError}</span>
            </div>
          )}
        </div>
      ) : (
        /* URL Input */
        <div className="space-y-3">
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Paste image or video URL"
              value={mediaUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="pl-10"
            />
            {mediaUrl && (
              <button
                onClick={clearMedia}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
