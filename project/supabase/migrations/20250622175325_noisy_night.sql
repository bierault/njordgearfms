/*
  # Add Projects and Folders Support

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text, unique within workspace)
      - `description` (text, optional)
      - `color` (text, default blue)
      - `workspace_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `folders`
      - `id` (uuid, primary key)
      - `name` (text)
      - `parent_id` (uuid, self-referencing for nested folders)
      - `project_id` (uuid, foreign key)
      - `path` (text, computed path for performance)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Updates to Files Table
    - Add `project_id` and `folder_id` columns
    - Update indexes for performance

  3. Security
    - Enable RLS on new tables
    - Add policies for public access
    - Create performance indexes
*/

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

-- Add project_id and folder_id to files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE files ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE files ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Allow public project read"
  ON projects
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public project insert"
  ON projects
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public project update"
  ON projects
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public project delete"
  ON projects
  FOR DELETE
  TO public
  USING (true);

-- Create policies for folders
CREATE POLICY "Allow public folder read"
  ON folders
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public folder insert"
  ON folders
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public folder update"
  ON folders
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public folder delete"
  ON folders
  FOR DELETE
  TO public
  USING (true);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS projects_workspace_name_idx ON projects(workspace_id, name);

CREATE INDEX IF NOT EXISTS folders_project_id_idx ON folders(project_id);
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);
CREATE INDEX IF NOT EXISTS folders_path_idx ON folders(path);
CREATE INDEX IF NOT EXISTS folders_project_parent_idx ON folders(project_id, parent_id);

CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id);
CREATE INDEX IF NOT EXISTS files_folder_id_idx ON files(folder_id);
CREATE INDEX IF NOT EXISTS files_project_folder_idx ON files(project_id, folder_id);

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update folder paths when parent changes
CREATE OR REPLACE FUNCTION update_folder_path()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the path for the current folder
  IF NEW.parent_id IS NULL THEN
    NEW.path = NEW.name;
  ELSE
    SELECT path || '/' || NEW.name INTO NEW.path
    FROM folders
    WHERE id = NEW.parent_id;
  END IF;
  
  -- Update paths for all child folders recursively
  WITH RECURSIVE folder_tree AS (
    SELECT id, name, parent_id, path
    FROM folders
    WHERE parent_id = NEW.id
    
    UNION ALL
    
    SELECT f.id, f.name, f.parent_id, ft.path || '/' || f.name
    FROM folders f
    JOIN folder_tree ft ON f.parent_id = ft.id
  )
  UPDATE folders
  SET path = folder_tree.path
  FROM folder_tree
  WHERE folders.id = folder_tree.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for path updates
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id, name ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_path();

-- Insert sample projects for each workspace
DO $$
DECLARE
  workspace_rec RECORD;
BEGIN
  FOR workspace_rec IN SELECT id, name FROM workspaces LOOP
    INSERT INTO projects (name, description, color, workspace_id) VALUES
      ('Design Projects', 'UI/UX designs and creative assets', '#8B5CF6', workspace_rec.id),
      ('Documents', 'Important documents and files', '#10B981', workspace_rec.id),
      ('Media Assets', 'Images, videos, and multimedia', '#F59E0B', workspace_rec.id),
      ('Development', 'Code and development resources', '#EF4444', workspace_rec.id)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;
END $$;

-- Create sample folders for each project
DO $$
DECLARE
  project_rec RECORD;
  folder_id uuid;
BEGIN
  FOR project_rec IN SELECT id, name FROM projects LOOP
    CASE project_rec.name
      WHEN 'Design Projects' THEN
        INSERT INTO folders (name, project_id, path) VALUES
          ('Mockups', project_rec.id, 'Mockups'),
          ('Icons', project_rec.id, 'Icons'),
          ('Branding', project_rec.id, 'Branding')
        ON CONFLICT DO NOTHING;
        
      WHEN 'Documents' THEN
        INSERT INTO folders (name, project_id, path) VALUES
          ('Contracts', project_rec.id, 'Contracts'),
          ('Reports', project_rec.id, 'Reports'),
          ('Presentations', project_rec.id, 'Presentations')
        ON CONFLICT DO NOTHING;
        
      WHEN 'Media Assets' THEN
        INSERT INTO folders (name, project_id, path) VALUES
          ('Photos', project_rec.id, 'Photos'),
          ('Videos', project_rec.id, 'Videos'),
          ('Audio', project_rec.id, 'Audio')
        ON CONFLICT DO NOTHING;
        
      WHEN 'Development' THEN
        INSERT INTO folders (name, project_id, path) VALUES
          ('Source Code', project_rec.id, 'Source Code'),
          ('Documentation', project_rec.id, 'Documentation'),
          ('Assets', project_rec.id, 'Assets')
        ON CONFLICT DO NOTHING;
    END CASE;
  END LOOP;
END $$;