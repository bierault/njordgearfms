/*
  # Complete Database Schema for File Management System

  1. Helper Functions
    - `update_updated_at_column()` - Updates the updated_at timestamp
    - `update_folder_path()` - Maintains folder path hierarchy

  2. Tables
    - `workspaces` - Workspace containers for organizing content
    - `projects` - Projects within workspaces
    - `folders` - Hierarchical folder structure within projects
    - `files` - File records with metadata and relationships

  3. Indexes
    - Performance indexes for all tables and common query patterns
    - GIN indexes for array fields (tags)
    - Composite indexes for workspace-scoped queries

  4. Security
    - Row Level Security enabled on all tables
    - Public access policies for all CRUD operations
    - Triggers for automatic timestamp and path updates
*/

-- Helper function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper function to update folder paths
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

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, parent_id, name)
);

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_category text DEFAULT 'other',
  file_size bigint DEFAULT 0,
  thumbnail_url text,
  tags text[] DEFAULT '{}',
  is_favorite boolean DEFAULT false,
  user_id uuid DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for workspaces
CREATE INDEX IF NOT EXISTS workspaces_pkey ON workspaces(id);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS projects_pkey ON projects(id);
CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS projects_workspace_name_idx ON projects(workspace_id, name);
CREATE INDEX IF NOT EXISTS projects_workspace_id_name_key ON projects(workspace_id, name);

-- Create indexes for folders
CREATE INDEX IF NOT EXISTS folders_pkey ON folders(id);
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);
CREATE INDEX IF NOT EXISTS folders_project_id_idx ON folders(project_id);
CREATE INDEX IF NOT EXISTS folders_project_parent_idx ON folders(project_id, parent_id);
CREATE INDEX IF NOT EXISTS folders_path_idx ON folders(path);
CREATE INDEX IF NOT EXISTS folders_project_id_parent_id_name_key ON folders(project_id, parent_id, name);

-- Create indexes for files
CREATE INDEX IF NOT EXISTS files_pkey ON files(id);
CREATE INDEX IF NOT EXISTS files_workspace_id_idx ON files(workspace_id);
CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id);
CREATE INDEX IF NOT EXISTS files_folder_id_idx ON files(folder_id);
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS files_file_category_idx ON files(file_category);
CREATE INDEX IF NOT EXISTS files_project_folder_idx ON files(project_id, folder_id);
CREATE INDEX IF NOT EXISTS files_workspace_created_at_idx ON files(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_workspace_category_idx ON files(workspace_id, file_category);
CREATE INDEX IF NOT EXISTS files_workspace_name_idx ON files(workspace_id, name);
CREATE INDEX IF NOT EXISTS files_workspace_size_idx ON files(workspace_id, file_size DESC);
CREATE INDEX IF NOT EXISTS files_workspace_favorite_idx ON files(workspace_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS files_tags_idx ON files USING gin(tags);
CREATE INDEX IF NOT EXISTS files_tags_workspace_gin_idx ON files USING gin(tags) WHERE workspace_id IS NOT NULL;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
DROP TRIGGER IF EXISTS update_files_updated_at ON files;
DROP TRIGGER IF EXISTS update_folder_path_trigger ON folders;

-- Create triggers for updated_at columns
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for folder path updates
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id, name ON folders
  FOR EACH ROW EXECUTE FUNCTION update_folder_path();

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public workspace read" ON workspaces;
DROP POLICY IF EXISTS "Allow public workspace insert" ON workspaces;
DROP POLICY IF EXISTS "Allow public workspace update" ON workspaces;
DROP POLICY IF EXISTS "Allow public workspace delete" ON workspaces;

DROP POLICY IF EXISTS "Allow public project read" ON projects;
DROP POLICY IF EXISTS "Allow public project insert" ON projects;
DROP POLICY IF EXISTS "Allow public project update" ON projects;
DROP POLICY IF EXISTS "Allow public project delete" ON projects;

DROP POLICY IF EXISTS "Allow public folder read" ON folders;
DROP POLICY IF EXISTS "Allow public folder insert" ON folders;
DROP POLICY IF EXISTS "Allow public folder update" ON folders;
DROP POLICY IF EXISTS "Allow public folder delete" ON folders;

DROP POLICY IF EXISTS "Allow public file read" ON files;
DROP POLICY IF EXISTS "Allow public file insert" ON files;
DROP POLICY IF EXISTS "Allow public file update" ON files;
DROP POLICY IF EXISTS "Allow public file delete" ON files;

-- Create RLS policies for workspaces
CREATE POLICY "Allow public workspace read" ON workspaces FOR SELECT TO public USING (true);
CREATE POLICY "Allow public workspace insert" ON workspaces FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public workspace update" ON workspaces FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public workspace delete" ON workspaces FOR DELETE TO public USING (true);

-- Create RLS policies for projects
CREATE POLICY "Allow public project read" ON projects FOR SELECT TO public USING (true);
CREATE POLICY "Allow public project insert" ON projects FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public project update" ON projects FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public project delete" ON projects FOR DELETE TO public USING (true);

-- Create RLS policies for folders
CREATE POLICY "Allow public folder read" ON folders FOR SELECT TO public USING (true);
CREATE POLICY "Allow public folder insert" ON folders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public folder update" ON folders FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public folder delete" ON folders FOR DELETE TO public USING (true);

-- Create RLS policies for files
CREATE POLICY "Allow public file read" ON files FOR SELECT TO public USING (true);
CREATE POLICY "Allow public file insert" ON files FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public file update" ON files FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public file delete" ON files FOR DELETE TO public USING (true);

-- Insert default workspaces if they don't exist
INSERT INTO workspaces (name, description, color) 
SELECT 'Marketing', 'Marketing materials and campaigns', '#10B981'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'Marketing');

INSERT INTO workspaces (name, description, color) 
SELECT 'Finance', 'Financial documents and reports', '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'Finance');

INSERT INTO workspaces (name, description, color) 
SELECT 'Design', 'Design assets and creative files', '#8B5CF6'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'Design');

INSERT INTO workspaces (name, description, color) 
SELECT 'General', 'General files and documents', '#3B82F6'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'General');