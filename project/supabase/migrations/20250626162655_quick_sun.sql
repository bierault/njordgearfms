/*
  # Create Tags Table and File-Tag Relationships

  1. New Tables
    - `tags`
      - `id` (uuid, primary key)
      - `name` (text, unique within workspace)
      - `color` (text, hex color for UI)
      - `workspace_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `file_tags` (junction table)
      - `file_id` (uuid, foreign key)
      - `tag_id` (uuid, foreign key)
      - `created_at` (timestamp)

  2. Migration Strategy
    - Create new tables
    - Migrate existing tags from files.tags array to new structure
    - Keep files.tags for backward compatibility initially
    - Add indexes for performance

  3. Security
    - Enable RLS on new tables
    - Add policies for public access
    - Create performance indexes
*/

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- Create file_tags junction table
CREATE TABLE IF NOT EXISTS file_tags (
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (file_id, tag_id)
);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags
CREATE POLICY "Allow public tag read"
  ON tags
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public tag insert"
  ON tags
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public tag update"
  ON tags
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public tag delete"
  ON tags
  FOR DELETE
  TO public
  USING (true);

-- Create policies for file_tags
CREATE POLICY "Allow public file_tags read"
  ON file_tags
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public file_tags insert"
  ON file_tags
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public file_tags update"
  ON file_tags
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public file_tags delete"
  ON file_tags
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tags_workspace_id_idx ON tags(workspace_id);
CREATE INDEX IF NOT EXISTS tags_workspace_name_idx ON tags(workspace_id, name);
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);

CREATE INDEX IF NOT EXISTS file_tags_file_id_idx ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS file_tags_tag_id_idx ON file_tags(tag_id);
CREATE INDEX IF NOT EXISTS file_tags_file_tag_idx ON file_tags(file_id, tag_id);

-- Create triggers for updated_at
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to migrate existing tags from files.tags array to new structure
CREATE OR REPLACE FUNCTION migrate_existing_tags()
RETURNS void AS $$
DECLARE
  file_record RECORD;
  tag_name text;
  tag_record RECORD;
  workspace_id_var uuid;
BEGIN
  -- Loop through all files that have tags
  FOR file_record IN 
    SELECT id, tags, workspace_id 
    FROM files 
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  LOOP
    workspace_id_var := file_record.workspace_id;
    
    -- Loop through each tag in the file's tags array
    FOREACH tag_name IN ARRAY file_record.tags
    LOOP
      -- Skip empty or null tags
      IF tag_name IS NULL OR trim(tag_name) = '' THEN
        CONTINUE;
      END IF;
      
      -- Check if tag already exists in workspace
      SELECT id INTO tag_record
      FROM tags 
      WHERE workspace_id = workspace_id_var 
      AND LOWER(name) = LOWER(trim(tag_name));
      
      -- If tag doesn't exist, create it
      IF NOT FOUND THEN
        INSERT INTO tags (name, workspace_id, color)
        VALUES (trim(tag_name), workspace_id_var, '#3B82F6')
        RETURNING id INTO tag_record;
      END IF;
      
      -- Create file-tag relationship if it doesn't exist
      INSERT INTO file_tags (file_id, tag_id)
      VALUES (file_record.id, tag_record.id)
      ON CONFLICT (file_id, tag_id) DO NOTHING;
      
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Tag migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to get tags for a file
CREATE OR REPLACE FUNCTION get_file_tags(file_id_param uuid)
RETURNS TABLE (
  tag_id uuid,
  tag_name text,
  tag_color text
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.color
  FROM tags t
  JOIN file_tags ft ON t.id = ft.tag_id
  WHERE ft.file_id = file_id_param
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get files by tag
CREATE OR REPLACE FUNCTION get_files_by_tag(tag_id_param uuid)
RETURNS TABLE (
  file_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.name, f.file_type, f.file_size, f.created_at
  FROM files f
  JOIN file_tags ft ON f.id = ft.file_id
  WHERE ft.tag_id = tag_id_param
  AND f.deleted_at IS NULL
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add tag to file
CREATE OR REPLACE FUNCTION add_tag_to_file(file_id_param uuid, tag_name_param text, workspace_id_param uuid)
RETURNS uuid AS $$
DECLARE
  tag_record RECORD;
  tag_id_result uuid;
BEGIN
  -- Check if tag exists, create if not
  SELECT id INTO tag_record
  FROM tags 
  WHERE workspace_id = workspace_id_param 
  AND LOWER(name) = LOWER(trim(tag_name_param));
  
  IF NOT FOUND THEN
    INSERT INTO tags (name, workspace_id, color)
    VALUES (trim(tag_name_param), workspace_id_param, '#3B82F6')
    RETURNING id INTO tag_id_result;
  ELSE
    tag_id_result := tag_record.id;
  END IF;
  
  -- Create file-tag relationship
  INSERT INTO file_tags (file_id, tag_id)
  VALUES (file_id_param, tag_id_result)
  ON CONFLICT (file_id, tag_id) DO NOTHING;
  
  RETURN tag_id_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove tag from file
CREATE OR REPLACE FUNCTION remove_tag_from_file(file_id_param uuid, tag_id_param uuid)
RETURNS boolean AS $$
BEGIN
  DELETE FROM file_tags 
  WHERE file_id = file_id_param AND tag_id = tag_id_param;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tag statistics for workspace
CREATE OR REPLACE FUNCTION get_workspace_tag_stats(workspace_id_param uuid)
RETURNS TABLE (
  tag_id uuid,
  tag_name text,
  tag_color text,
  file_count bigint,
  total_size bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.color,
    COUNT(ft.file_id)::bigint as file_count,
    COALESCE(SUM(f.file_size), 0)::bigint as total_size
  FROM tags t
  LEFT JOIN file_tags ft ON t.id = ft.tag_id
  LEFT JOIN files f ON ft.file_id = f.id AND f.deleted_at IS NULL
  WHERE t.workspace_id = workspace_id_param
  GROUP BY t.id, t.name, t.color
  ORDER BY file_count DESC, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the migration
SELECT migrate_existing_tags();

-- Add comments for documentation
COMMENT ON TABLE tags IS 'Tags for organizing files within workspaces';
COMMENT ON TABLE file_tags IS 'Junction table linking files to tags';
COMMENT ON FUNCTION migrate_existing_tags() IS 'Migrate existing tags from files.tags array to new tag system';
COMMENT ON FUNCTION get_file_tags(uuid) IS 'Get all tags for a specific file';
COMMENT ON FUNCTION get_files_by_tag(uuid) IS 'Get all files with a specific tag';
COMMENT ON FUNCTION add_tag_to_file(uuid, text, uuid) IS 'Add a tag to a file, creating tag if needed';
COMMENT ON FUNCTION remove_tag_from_file(uuid, uuid) IS 'Remove a tag from a file';
COMMENT ON FUNCTION get_workspace_tag_stats(uuid) IS 'Get tag statistics for a workspace';