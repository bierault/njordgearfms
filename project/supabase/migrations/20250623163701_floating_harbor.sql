/*
  # Fix get_trash_stats function type mismatch

  1. Problem
    - The get_trash_stats function returns numeric type for total_size
    - TypeScript expects bigint type
    - This causes "structure of query does not match function result type" error

  2. Solution
    - Cast SUM(file_size) to bigint explicitly
    - Cast COUNT(*) to bigint for consistency
    - Ensure all return types match the expected bigint types

  3. Changes
    - Update get_trash_stats function with proper type casting
    - Maintain backward compatibility
    - Fix type mismatch errors
*/

-- Drop and recreate the get_trash_stats function with proper type casting
DROP FUNCTION IF EXISTS get_trash_stats(uuid);

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
    COUNT(*)::bigint as total_files,
    COALESCE(SUM(file_size), 0)::bigint as total_size,
    MIN(deleted_at) as oldest_deletion,
    COUNT(*) FILTER (WHERE deleted_at < (now() - INTERVAL '23 days'))::bigint as files_expiring_soon
  FROM files
  WHERE workspace_id = workspace_id_param 
  AND deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;