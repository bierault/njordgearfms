/*
  # Fix User Accounts and Ensure Proper Role Assignment

  1. Updates
    - Ensure admin@gmail.com and employee@gmail.com have correct roles
    - Fix any existing user records that might have wrong roles
    - Update the workspace indicator to be more minimalist

  2. Security
    - Maintain simple RLS policies without recursion
    - Ensure proper role assignment based on email
*/

-- Update existing users to have correct roles based on email
UPDATE users 
SET role = 'admin', updated_at = now()
WHERE email = 'admin@gmail.com' AND role != 'admin';

UPDATE users 
SET role = 'employee', updated_at = now()
WHERE email = 'employee@gmail.com' AND role != 'employee';

-- Update auth metadata to match
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE email = 'admin@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'employee')
WHERE email = 'employee@gmail.com';

-- Ensure both accounts exist in users table
DO $$
DECLARE
  admin_auth_id uuid;
  employee_auth_id uuid;
  default_workspace_id uuid;
BEGIN
  -- Get default workspace
  SELECT id INTO default_workspace_id FROM workspaces WHERE name = 'General' LIMIT 1;
  
  -- Get admin auth ID
  SELECT id INTO admin_auth_id FROM auth.users WHERE email = 'admin@gmail.com';
  IF admin_auth_id IS NOT NULL THEN
    -- Ensure admin profile exists
    INSERT INTO users (id, email, name, role, workspace_id, project_access)
    VALUES (admin_auth_id, 'admin@gmail.com', 'Admin User', 'admin', default_workspace_id, NULL)
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      workspace_id = default_workspace_id,
      updated_at = now();
  END IF;

  -- Get employee auth ID
  SELECT id INTO employee_auth_id FROM auth.users WHERE email = 'employee@gmail.com';
  IF employee_auth_id IS NOT NULL THEN
    -- Ensure employee profile exists
    INSERT INTO users (id, email, name, role, workspace_id, project_access)
    VALUES (employee_auth_id, 'employee@gmail.com', 'Employee User', 'employee', default_workspace_id, '{}')
    ON CONFLICT (id) DO UPDATE SET
      role = 'employee',
      workspace_id = default_workspace_id,
      updated_at = now();
  END IF;
END $$;