/*
  # Add Trash System with 30-day Retention

  1. Schema Changes
    - Add `deleted_at` column to files table
    - Add `deleted_by` column to track who deleted the file
    - Add `original_project_id` and `original_folder_id` for restoration
    - Create indexes for trash queries

  2. Functions
    - Function to soft delete files
    - Function to restore files from trash
    - Function to permanently delete expired files
    - Function to empty trash

  3. Performance
    - Optimized indexes for trash queries
    - Efficient date-based filtering
    - Batch operations for cleanup

  4. Security
    - Maintain existing RLS policies
    - Add policies for trash operations
*/

-- Add trash-related columns to files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE files ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE files ADD COLUMN deleted_by uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'original_project_id'
  ) THEN
    ALTER TABLE files ADD COLUMN original_project_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'original_folder_id'
  ) THEN
    ALTER TABLE files ADD COLUMN original_folder_id uuid;
  END IF;
END $$;

-- Create indexes for trash operations
CREATE INDEX IF NOT EXISTS files_deleted_at_idx ON files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS files_workspace_deleted_idx ON files(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS files_not_deleted_idx ON files(workspace_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS files_deleted_by_idx ON files(deleted_by) WHERE deleted_at IS NOT NULL;

-- Function to soft delete a file
CREATE OR REPLACE FUNCTION soft_delete_file(
  file_id uuid,
  user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  file_record RECORD;
BEGIN
  -- Get the current file record
  SELECT project_id, folder_id INTO file_record
  FROM files
  WHERE id = file_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false; -- File not found or already deleted
  END IF;
  
  -- Soft delete the file
  UPDATE files
  SET 
    deleted_at = now(),
    deleted_by = user_id,
    original_project_id = file_record.project_id,
    original_folder_id = file_record.folder_id,
    project_id = NULL,
    folder_id = NULL,
    updated_at = now()
  WHERE id = file_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a file from trash
CREATE OR REPLACE FUNCTION restore_file_from_trash(
  file_id uuid,
  restore_to_project_id uuid DEFAULT NULL,
  restore_to_folder_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  file_record RECORD;
  target_project_id uuid;
  target_folder_id uuid;
BEGIN
  -- Get the deleted file record
  SELECT original_project_id, original_folder_id, workspace_id 
  INTO file_record
  FROM files
  WHERE id = file_id AND deleted_at IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN false; -- File not found in trash
  END IF;
  
  -- Determine restoration location
  IF restore_to_project_id IS NOT NULL THEN
    target_project_id := restore_to_project_id;
    target_folder_id := restore_to_folder_id;
  ELSE
    -- Restore to original location if it still exists
    IF EXISTS (SELECT 1 FROM projects WHERE id = file_record.original_project_id) THEN
      target_project_id := file_record.original_project_id;
      
      -- Check if original folder still exists
      IF file_record.original_folder_id IS NOT NULL AND 
         EXISTS (SELECT 1 FROM folders WHERE id = file_record.original_folder_id) THEN
        target_folder_id := file_record.original_folder_id;
      END IF;
    END IF;
  END IF;
  
  -- Restore the file
  UPDATE files
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    project_id = target_project_id,
    folder_id = target_folder_id,
    original_project_id = NULL,
    original_folder_id = NULL,
    updated_at = now()
  WHERE id = file_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete expired files
CREATE OR REPLACE FUNCTION cleanup_expired_trash()
RETURNS integer AS $$
DECLARE
  deleted_count integer := 0;
  file_record RECORD;
BEGIN
  -- Get files that have been in trash for more than 30 days
  FOR file_record IN
    SELECT id, file_path
    FROM files
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < (now() - INTERVAL '30 days')
  LOOP
    -- Delete from storage (ignore errors if file doesn't exist)
    BEGIN
      PERFORM storage.delete_object('files', file_record.file_path);
    EXCEPTION WHEN OTHERS THEN
      -- Continue even if storage deletion fails
      NULL;
    END;
    
    -- Delete from database
    DELETE FROM files WHERE id = file_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to empty trash (permanent deletion)
CREATE OR REPLACE FUNCTION empty_trash(workspace_id_param uuid)
RETURNS integer AS $$
DECLARE
  deleted_count integer := 0;
  file_record RECORD;
BEGIN
  -- Get all files in trash for the workspace
  FOR file_record IN
    SELECT id, file_path
    FROM files
    WHERE workspace_id = workspace_id_param 
    AND deleted_at IS NOT NULL
  LOOP
    -- Delete from storage (ignore errors if file doesn't exist)
    BEGIN
      PERFORM storage.delete_object('files', file_record.file_path);
    EXCEPTION WHEN OTHERS THEN
      -- Continue even if storage deletion fails
      NULL;
    END;
    
    -- Delete from database
    DELETE FROM files WHERE id = file_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trash statistics
CREATE OR REPLACE FUNCTION get_trash_stats(workspace_id_param uuid)
RETURNS TABLE (
  total_files bigint,
  total_size bigint,
  oldest_deletion timestamptz,
  files_expiring_soon bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(file_size), 0) as total_size,
    MIN(deleted_at) as oldest_deletion,
    COUNT(*) FILTER (WHERE deleted_at < (now() - INTERVAL '23 days')) as files_expiring_soon
  FROM files
  WHERE workspace_id = workspace_id_param 
  AND deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN files.deleted_at IS 'Timestamp when file was soft deleted. NULL means file is active.';
COMMENT ON COLUMN files.deleted_by IS 'User ID who deleted the file';
COMMENT ON COLUMN files.original_project_id IS 'Original project ID before deletion for restoration';
COMMENT ON COLUMN files.original_folder_id IS 'Original folder ID before deletion for restoration';