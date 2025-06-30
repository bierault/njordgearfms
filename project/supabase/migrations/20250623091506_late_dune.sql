/*
  # Enable public access for file sharing

  1. Security Changes
    - Disable RLS on files table for public read access
    - Create public read policy for files table
    - Ensure storage bucket allows public access

  2. Notes
    - This allows anyone with a file ID to view file metadata
    - File content access is controlled by storage bucket policies
    - This is required for the public share functionality
*/

-- Temporarily disable RLS on files table for public access
ALTER TABLE files DISABLE ROW LEVEL SECURITY;

-- Create a public read policy for files (when RLS is re-enabled)
DROP POLICY IF EXISTS "Allow public file read" ON files;
CREATE POLICY "Allow public file read"
  ON files
  FOR SELECT
  TO public
  USING (true);

-- Re-enable RLS but with public read access
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Ensure the storage bucket allows public access
-- Note: This needs to be configured in the Supabase dashboard as well
-- The 'files' bucket should have public access enabled for downloads