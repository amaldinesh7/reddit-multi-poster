import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, Video, Link, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  onUrl: (url: string) => void;
  onFile: (files: File[]) => void; // Changed to accept array of files
  mode: 'file' | 'url';
}

export default function MediaUpload({ onUrl, onFile, mode }: Props) {
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]); // Changed to array
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]); // Changed to array

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    multiple: true, // Allow multiple files
    maxFiles: 10, // Limit to 10 files
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFilesSelect(acceptedFiles);
      }
    }
  });

  const handleFilesSelect = (files: File[]) => {
    // Clean up previous previews
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    
    setSelectedFiles(files);
    setMediaUrl('');
    onFile(files);
    onUrl('');
    
    // Create previews
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(previews);
  };

  const handleUrlChange = (url: string) => {
    setMediaUrl(url);
    setSelectedFiles([]);
    onUrl(url);
    onFile([]);
    
    // Clean up file previews
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);
    
    // Clean up removed preview
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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || 
           /i\.(imgur|redd\.it|reddit)/i.test(url);
  };

  const hasContent = selectedFiles.length > 0 || mediaUrl;

  return (
    <div className="space-y-4">

      {mode === 'file' ? (
        /* File Upload */
        <Card className='p-6 border-none pt-2'>
         
            <div
              {...getRootProps()}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
                ${selectedFiles.length > 0 ? 'border-primary bg-primary/5' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              {selectedFiles.length > 0 ? (
                <div className="space-y-4">
                  {/* Files Info */}
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="h-6 w-6 text-primary" />
                    <span className="font-medium">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</span>
                    <Badge variant="secondary">
                      {(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(1)} MB total
                    </Badge>
                  </div>
                  
                  {/* Files Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="border rounded-lg p-2 bg-background">
                          {/* Preview */}
                          {previewUrls[index] && (
                            <div className="aspect-square mb-2 relative overflow-hidden rounded">
                              {file.type.startsWith('video/') ? (
                                <video 
                                  src={previewUrls[index]} 
                                  className="w-full h-full object-cover"
                                  muted
                                />
                              ) : (
                                <img 
                                  src={previewUrls[index]} 
                                  alt={`Preview ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              )}
                              {/* Remove button */}
                              <Button
                                size="sm"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {/* File info */}
                          <div className="text-xs text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              {file.type.startsWith('video/') ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <Image className="h-3 w-3" />
                              )}
                            </div>
                            <div className="truncate" title={file.name}>{file.name}</div>
                            <div className="text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {selectedFiles.length > 1 
                      ? 'Multiple files will be posted as a single gallery post.'
                      : 'Will upload directly to Reddit.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {isDragActive ? 'Drop files here' : 'Upload media files'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to select images/videos
                    </p>
                  </div>
                </div>
              )}
            </div>
        </Card>
      ) : (
        /* URL Input */
        <Card className='p-6 pt-2 border-none'>
            <div className="space-y-2">
              <Label htmlFor="url-input">Media URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  placeholder="https://example.com/image.jpg"
                  value={mediaUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            
            {mediaUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Link Post</span>
                  <Badge variant="outline">URL</Badge>
                </div>
                
                {/* URL Preview */}
                {isImageUrl(mediaUrl) && (
                  <div className="flex justify-center">
                    <img 
                      src={mediaUrl} 
                      alt="URL Preview"
                      className="max-w-xs max-h-48 rounded-md border object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  Will post as link to external URL
                </p>
              </div>
            )}
        </Card>
      )}

      {/* Clear Button */}
      {hasContent && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={clearMedia} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Clear Media
          </Button>
        </div>
      )}
    </div>
  );
} 