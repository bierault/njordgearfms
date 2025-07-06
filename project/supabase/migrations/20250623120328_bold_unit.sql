/*
  # Add file_url column for n8n automation integration

  1. Schema Changes
    - Add `file_url` column to files table as text type
    - This will store external URLs for files to enable n8n automation matching
    - Column is nullable to maintain backward compatibility

  2. Performance Optimizations
    - Add index on file_url for faster lookups
    - Add index on workspace_id + file_url combination for efficient queries

  3. Security
    - Maintain existing RLS policies
    - No additional permissions needed for file_url column
*/

-- Add file_url column to files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE files ADD COLUMN file_url text;
  END IF;
END $$;

-- Add index for file_url lookups
CREATE INDEX IF NOT EXISTS files_file_url_idx ON files (file_url) WHERE file_url IS NOT NULL;

-- Add composite index for workspace + file_url queries
CREATE INDEX IF NOT EXISTS files_workspace_file_url_idx ON files (workspace_id, file_url) WHERE file_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN files.file_url IS 'External URL for file integration with automation tools like n8n';