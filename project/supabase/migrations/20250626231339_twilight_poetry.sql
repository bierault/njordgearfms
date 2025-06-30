/*
  # Remove standalone tags table

  1. Changes
    - Drop the standalone tags table and file_tags junction table
    - Keep only the tags array column in the files table
    - This simplifies the tag system to use only one storage method

  2. Security
    - No changes to RLS policies needed
*/

-- Drop the junction table first (due to foreign key constraints)
DROP TABLE IF EXISTS file_tags;

-- Drop the standalone tags table
DROP TABLE IF EXISTS tags;

-- The files.tags column remains as the single source of truth for tags