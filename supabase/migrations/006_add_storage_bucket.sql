-- Create the queue-files storage bucket for media uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'queue-files',
  'queue-files',
  true,  -- public bucket so files can be accessed
  26214400,  -- 25MB file size limit (in bytes)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload queue files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'queue-files');

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read queue files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'queue-files');

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete queue files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'queue-files');

-- Policy: Allow public read access (for sharing media)
CREATE POLICY "Public can read queue files"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'queue-files');
