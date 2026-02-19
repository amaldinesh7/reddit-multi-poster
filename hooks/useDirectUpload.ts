import { useState, useCallback } from 'react';

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  itemIndex: number;
  fileIndex: number;
}

interface UploadProgress {
  current: number;
  total: number;
  fileName: string;
}

interface UseDirectUploadReturn {
  uploadFiles: (
    files: File[],
    jobFolder: string,
    itemIndex?: number
  ) => Promise<UploadedFile[]>;
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  reset: () => void;
}

interface UploadUrlResponse {
  uploadUrl: string;
  token: string;
  storagePath: string;
}

export function useDirectUpload(): UseDirectUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(null);
    setError(null);
  }, []);

  const uploadFiles = useCallback(
    async (
      files: File[],
      jobFolder: string,
      itemIndex: number = -1
    ): Promise<UploadedFile[]> => {
      if (files.length === 0) {
        return [];
      }

      setIsUploading(true);
      setError(null);
      setProgress({ current: 0, total: files.length, fileName: '' });

      const uploadedFiles: UploadedFile[] = [];

      try {
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const file = files[fileIndex];

          setProgress({
            current: fileIndex,
            total: files.length,
            fileName: file.name,
          });

          const urlResponse = await fetch('/api/storage/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              jobFolder,
              itemIndex,
              fileIndex,
            }),
          });

          if (!urlResponse.ok) {
            const errorData = await urlResponse.json();
            throw new Error(errorData.details || errorData.error || 'Failed to get upload URL');
          }

          const { uploadUrl, storagePath }: UploadUrlResponse =
            await urlResponse.json();

          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type,
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}: ${uploadResponse.statusText}`);
          }

          uploadedFiles.push({
            storagePath,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            itemIndex,
            fileIndex,
          });
        }

        setProgress({
          current: files.length,
          total: files.length,
          fileName: 'Complete',
        });

        return uploadedFiles;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return {
    uploadFiles,
    isUploading,
    progress,
    error,
    reset,
  };
}
