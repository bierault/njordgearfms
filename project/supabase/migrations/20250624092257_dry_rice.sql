/*
  # Fix folder deletion to properly move files and subfolders

  1. Enhanced Folder Deletion Function
    - Move all files from deleted folder to parent folder or project root
    - Move all subfolders to parent folder or project root
    - Ensure proper cleanup and data integrity
    - Handle edge cases and error conditions

  2. Performance Optimizations
    - Batch operations for better performance
    - Proper indexing for folder hierarchy queries
    - Efficient file movement operations

  3. Data Integrity
    - Ensure no orphaned files or folders
    - Maintain proper foreign key relationships
    - Handle cascading updates correctly
*/

-- Create enhanced function for safe folder deletion
CREATE OR REPLACE FUNCTION delete_folder_safely(folder_id_param uuid)
RETURNS boolean AS $$
DECLARE
  folder_record RECORD;
  files_moved integer := 0;
  subfolders_moved integer := 0;
BEGIN
  -- Get folder details
  SELECT id, name, parent_id, project_id INTO folder_record
  FROM folders
  WHERE id = folder_id_param;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Folder not found: %', folder_id_param;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Deleting folder: % (parent: %, project: %)', 
    folder_record.name, folder_record.parent_id, folder_record.project_id;
  
  -- Move all files from this folder to parent folder or project root
  UPDATE files 
  SET 
    folder_id = folder_record.parent_id,
    project_id = folder_record.project_id,
    updated_at = now()
  WHERE folder_id = folder_id_param;
  
  GET DIAGNOSTICS files_moved = ROW_COUNT;
  RAISE NOTICE 'Moved % files to %', files_moved, 
    CASE WHEN folder_record.parent_id IS NULL THEN 'project root' ELSE 'parent folder' END;
  
  -- Move all subfolders to parent folder or project root
  UPDATE folders 
  SET 
    parent_id = folder_record.parent_id,
    updated_at = now()
  WHERE parent_id = folder_id_param;
  
  GET DIAGNOSTICS subfolders_moved = ROW_COUNT;
  RAISE NOTICE 'Moved % subfolders to %', subfolders_moved,
    CASE WHEN folder_record.parent_id IS NULL THEN 'project root' ELSE 'parent folder' END;
  
  -- Delete the folder
  DELETE FROM folders WHERE id = folder_id_param;
  
  RAISE NOTICE 'Successfully deleted folder and moved % files and % subfolders', 
    files_moved, subfolders_moved;
  
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error deleting folder: %', SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up orphaned records
CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS TABLE (
  orphaned_files integer,
  orphaned_folders integer,
  fixed_files integer
) AS $$
DECLARE
  files_cleaned integer := 0;
  folders_cleaned integer := 0;
  files_fixed integer := 0;
BEGIN
  -- Count orphaned files (files with invalid folder_id)
  SELECT COUNT(*) INTO files_cleaned
  FROM files f
  WHERE f.folder_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM folders WHERE id = f.folder_id);
  
  -- Count orphaned folders (folders with invalid parent_id)
  SELECT COUNT(*) INTO folders_cleaned
  FROM folders f
  WHERE f.parent_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM folders WHERE id = f.parent_id);
  
  -- Fix orphaned files by setting folder_id to NULL
  UPDATE files 
  SET folder_id = NULL, updated_at = now()
  WHERE folder_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM folders WHERE id = files.folder_id);
  
  GET DIAGNOSTICS files_fixed = ROW_COUNT;
  
  -- Fix orphaned folders by setting parent_id to NULL
  UPDATE folders 
  SET parent_id = NULL, updated_at = now()
  WHERE parent_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM folders WHERE id = folders.parent_id);
  
  RETURN QUERY SELECT files_cleaned, folders_cleaned, files_fixed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add additional indexes for better folder deletion performance
CREATE INDEX IF NOT EXISTS files_folder_project_idx ON files(folder_id, project_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS folders_parent_project_idx ON folders(parent_id, project_id) WHERE parent_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON FUNCTION delete_folder_safely(uuid) IS 'Safely delete a folder by moving all files and subfolders to parent location';
COMMENT ON FUNCTION cleanup_orphaned_records() IS 'Clean up orphaned files and folders with invalid references';