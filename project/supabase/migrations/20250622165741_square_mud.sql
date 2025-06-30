/*
  # Update file access policies for anonymous users

  1. Policy Updates
    - Drop existing authentication-required policies
    - Create new policies that allow anonymous access
    - Allow public read, insert, update, and delete operations
    - Support both anonymous (user_id IS NULL) and authenticated users

  2. Storage Policy Updates
    - Drop existing user-specific storage policies
    - Create new storage policies for anonymous access
    - Allow public access to files bucket operations

  3. Changes
    - Files can be uploaded without authentication
    - All users can access all files (anonymous mode)
    - Maintains compatibility with authenticated users if needed later
*/

-- Drop existing RLS policies that require authentication
DROP POLICY IF EXISTS "Users can read own files" ON files;
DROP POLICY IF EXISTS "Users can insert own files" ON files;
DROP POLICY IF EXISTS "Users can update own files" ON files;
DROP POLICY IF EXISTS "Users can delete own files" ON files;

-- Drop the conflicting policy if it exists
DROP POLICY IF EXISTS "Allow public read/upload" ON files;

-- Create new policies that allow anonymous access
CREATE POLICY "Allow public file read"
  ON files
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public file insert"
  ON files
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public file update"
  ON files
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public file delete"
  ON files
  FOR DELETE
  TO public
  USING (true);

-- Update storage policies for anonymous access
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Drop any existing anonymous policies to avoid conflicts
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public file access" ON storage.objects;
DROP POLICY IF EXISTS "Allow file updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow file deletion" ON storage.objects;

-- Create new storage policies for anonymous access
CREATE POLICY "Public storage upload"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Public storage read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Public storage update"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Public storage delete"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'files');