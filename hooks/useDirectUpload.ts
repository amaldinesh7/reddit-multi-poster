import { useState, useCallback, useRef } from 'react';
import { addUIBreadcrumb } from '@/lib/clientErrorHandler';

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
  cancelUpload: () => void;
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

const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 2000];

const isRetryableError = (error: unknown, response?: Response): boolean => {
  if (error instanceof TypeError) {
    return true;
  }
  if (response && response.status >= 500) {
    return true;
  }
  return false;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function useDirectUpload(): UseDirectUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(null);
    setError(null);
  }, []);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

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

          addUIBreadcrumb('upload-url-start', {
            fileName: file.name,
            fileSize: file.size,
            fileIndex,
            itemIndex,
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
            signal,
          });

          if (!urlResponse.ok) {
            const errorData = await urlResponse.json();
            throw new Error(
              errorData.details || errorData.error || 'Failed to get upload URL'
            );
          }

          const { uploadUrl, storagePath }: UploadUrlResponse =
            await urlResponse.json();

          addUIBreadcrumb('upload-url-success', {
            storagePath,
            fileIndex,
          });

          addUIBreadcrumb('storage-put-start', {
            storagePath,
            fileSize: file.size,
            fileIndex,
          });

          let uploadResponse: Response | undefined;
          let lastError: unknown;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              const timeoutSignal = AbortSignal.timeout(UPLOAD_TIMEOUT_MS);
              const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

              uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': file.type,
                },
                body: file,
                signal: combinedSignal,
              });

              if (uploadResponse.ok) {
                break;
              }

              if (!isRetryableError(null, uploadResponse)) {
                throw new Error(
                  `Failed to upload ${file.name}: ${uploadResponse.statusText}`
                );
              }

              lastError = new Error(
                `Failed to upload ${file.name}: ${uploadResponse.statusText}`
              );
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') {
                throw err;
              }

              if (err instanceof Error && err.name === 'TimeoutError') {
                lastError = new Error(
                  `Upload timed out for ${file.name}. Please check your connection and try again.`
                );
              } else {
                lastError = err;
              }

              if (!isRetryableError(err)) {
                throw lastError;
              }
            }

            if (attempt < MAX_RETRIES) {
              addUIBreadcrumb('storage-put-retry', {
                storagePath,
                attempt: attempt + 1,
                fileIndex,
              });
              await delay(RETRY_DELAYS_MS[attempt]);
            }
          }

          if (!uploadResponse?.ok) {
            throw lastError || new Error(`Failed to upload ${file.name}`);
          }

          addUIBreadcrumb('storage-put-success', {
            storagePath,
            fileIndex,
          });

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
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Upload cancelled');
          throw err;
        }

        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);

        addUIBreadcrumb('upload-failed', {
          error: errorMessage,
          uploadedCount: uploadedFiles.length,
          totalFiles: files.length,
        });

        throw err;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return {
    uploadFiles,
    cancelUpload,
    isUploading,
    progress,
    error,
    reset,
  };
}
