/*
  # Ensure workspace scoping for projects and folders

  1. Schema Verification
    - Verify projects table has workspace_id foreign key
    - Verify folders table links to projects correctly
    - Add any missing indexes for workspace-scoped queries

  2. Performance Optimizations
    - Add composite indexes for workspace + project queries
    - Add indexes for folder hierarchy queries
    - Optimize for drag-and-drop operations

  3. Data Integrity
    - Ensure all projects belong to workspaces
    - Ensure all folders belong to projects
    - Clean up any orphaned records
*/

-- Ensure projects table has proper workspace relationship
DO $$
BEGIN
  -- Add workspace_id column if it doesn't exist (should already exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure folders table has proper project relationship
DO $$
BEGIN
  -- Add project_id column if it doesn't exist (should already exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folders' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE folders ADD COLUMN project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create optimized indexes for workspace-scoped queries
CREATE INDEX IF NOT EXISTS projects_workspace_id_name_idx ON projects(workspace_id, name);
CREATE INDEX IF NOT EXISTS projects_workspace_created_at_idx ON projects(workspace_id, created_at DESC);

-- Create optimized indexes for folder operations
CREATE INDEX IF NOT EXISTS folders_project_parent_name_idx ON folders(project_id, parent_id, name);
CREATE INDEX IF NOT EXISTS folders_parent_path_idx ON folders(parent_id, path);

-- Create optimized indexes for file operations within workspace context
CREATE INDEX IF NOT EXISTS files_workspace_project_folder_idx ON files(workspace_id, project_id, folder_id);
CREATE INDEX IF NOT EXISTS files_project_folder_created_idx ON files(project_id, folder_id, created_at DESC);

-- Update the folder path function to be more efficient
CREATE OR REPLACE FUNCTION update_folder_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path text := '';
BEGIN
  -- Get parent path if parent_id exists
  IF NEW.parent_id IS NOT NULL THEN
    SELECT path INTO parent_path
    FROM folders
    WHERE id = NEW.parent_id;
    
    IF parent_path IS NOT NULL THEN
      NEW.path := parent_path || '/' || NEW.name;
    ELSE
      NEW.path := NEW.name;
    END IF;
  ELSE
    NEW.path := NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists for folder path updates
DROP TRIGGER IF EXISTS update_folder_path_trigger ON folders;
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id, name ON folders
  FOR EACH ROW EXECUTE FUNCTION update_folder_path();

-- Clean up any orphaned records (projects without workspaces)
DELETE FROM projects WHERE workspace_id NOT IN (SELECT id FROM workspaces);

-- Clean up any orphaned folders (folders without projects)
DELETE FROM folders WHERE project_id NOT IN (SELECT id FROM projects);

-- Clean up any orphaned files (files with invalid workspace_id)
DELETE FROM files WHERE workspace_id NOT IN (SELECT id FROM workspaces);

-- Update file records to ensure workspace consistency
UPDATE files 
SET workspace_id = p.workspace_id
FROM projects p
WHERE files.project_id = p.id 
AND files.workspace_id != p.workspace_id;

-- Add comment for documentation
COMMENT ON INDEX projects_workspace_id_name_idx IS 'Optimized index for workspace-scoped project queries';
COMMENT ON INDEX folders_project_parent_name_idx IS 'Optimized index for folder hierarchy operations';
COMMENT ON INDEX files_workspace_project_folder_idx IS 'Optimized index for workspace-scoped file queries';