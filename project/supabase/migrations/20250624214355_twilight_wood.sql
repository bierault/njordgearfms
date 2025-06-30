/*
  # Add User Roles System with Admin and Employee Types

  1. Table Updates
    - Ensure users table exists with proper structure
    - Add name column for user full names
    - Add project_access column for employee permissions
    - Create performance indexes

  2. Functions
    - Function to check project access permissions
    - Function to create employee accounts (admin only)
    - Function to update user project access
    - Function to get user permissions summary

  3. Security
    - Enhanced RLS policies for role-based access
    - Admin-only functions with proper validation
    - Workspace-scoped user management

  4. Performance
    - Optimized indexes for role and project access queries
    - Efficient permission checking functions
*/

-- Ensure users table exists with complete structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  project_access uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add name column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name text;
  END IF;
END $$;

-- Add project_access column for employee permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'project_access'
  ) THEN
    ALTER TABLE users ADD COLUMN project_access uuid[];
  END IF;
END $$;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_workspace_id_idx ON users(workspace_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_role_workspace_idx ON users(role, workspace_id);
CREATE INDEX IF NOT EXISTS users_project_access_gin_idx ON users USING gin(project_access) WHERE project_access IS NOT NULL;

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to check if user has project access
CREATE OR REPLACE FUNCTION user_has_project_access(user_id uuid, project_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
  user_project_access uuid[];
BEGIN
  -- Get user role and project access
  SELECT role, project_access INTO user_role, user_project_access
  FROM users
  WHERE id = user_id;
  
  -- Admins have access to all projects
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Employees only have access to assigned projects
  IF user_role = 'employee' AND user_project_access IS NOT NULL THEN
    RETURN project_id = ANY(user_project_access);
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create employee account (admin only)
CREATE OR REPLACE FUNCTION create_employee_account(
  employee_email text,
  employee_name text,
  employee_workspace_id uuid,
  employee_project_access uuid[] DEFAULT '{}'
)
RETURNS json AS $$
DECLARE
  current_user_role text;
  new_user_id uuid;
  result json;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM users
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create employee accounts';
  END IF;
  
  -- Generate new user ID
  new_user_id := gen_random_uuid();
  
  -- Insert user record (auth user will be created separately)
  INSERT INTO users (id, email, name, role, workspace_id, project_access)
  VALUES (new_user_id, employee_email, employee_name, 'employee', employee_workspace_id, employee_project_access);
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'Employee account created successfully'
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user project access (admin only)
CREATE OR REPLACE FUNCTION update_user_project_access(
  target_user_id uuid,
  new_project_access uuid[]
)
RETURNS boolean AS $$
DECLARE
  current_user_role text;
  target_user_workspace uuid;
  current_user_workspace uuid;
BEGIN
  -- Check if current user is admin
  SELECT role, workspace_id INTO current_user_role, current_user_workspace
  FROM users
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update user project access';
  END IF;
  
  -- Get target user workspace
  SELECT workspace_id INTO target_user_workspace
  FROM users
  WHERE id = target_user_id;
  
  -- Ensure both users are in the same workspace
  IF current_user_workspace != target_user_workspace THEN
    RAISE EXCEPTION 'Cannot modify users from different workspaces';
  END IF;
  
  -- Update project access
  UPDATE users
  SET project_access = new_project_access,
      updated_at = now()
  WHERE id = target_user_id;
  
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to update user project access: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user permissions summary
CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS json AS $$
DECLARE
  user_record RECORD;
  permissions json;
BEGIN
  -- Get user data
  SELECT * INTO user_record
  FROM users
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Build permissions object
  permissions := json_build_object(
    'user_id', user_record.id,
    'role', user_record.role,
    'workspace_id', user_record.workspace_id,
    'project_access', COALESCE(user_record.project_access, '{}'),
    'can_delete_files', (user_record.role = 'admin'),
    'can_edit_tags', (user_record.role = 'admin'),
    'can_move_files', (user_record.role = 'admin'),
    'can_manage_users', (user_record.role = 'admin')
  );
  
  RETURN permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing RLS policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users in workspace" ON users;
DROP POLICY IF EXISTS "Admins can update users in workspace" ON users;
DROP POLICY IF EXISTS "Admins can insert users in workspace" ON users;
DROP POLICY IF EXISTS "Admins can read workspace users" ON users;
DROP POLICY IF EXISTS "Admins can manage workspace users" ON users;

-- Create enhanced RLS policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can read workspace users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin' 
      AND admin_user.workspace_id = users.workspace_id
    )
  );

CREATE POLICY "Admins can manage workspace users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin' 
      AND admin_user.workspace_id = users.workspace_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin' 
      AND admin_user.workspace_id = workspace_id
    )
  );

-- Update the existing user creation trigger to handle the new columns
DROP FUNCTION IF EXISTS handle_admin_signup();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create updated function to handle new user signup with enhanced features
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  default_workspace_id uuid;
  existing_profile_id uuid;
BEGIN
  -- Get default workspace
  SELECT id INTO default_workspace_id 
  FROM workspaces 
  WHERE name = 'General' 
  LIMIT 1;
  
  -- If no workspace exists, create one
  IF default_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, description, color)
    VALUES ('General', 'Default workspace', '#3B82F6')
    RETURNING id INTO default_workspace_id;
  END IF;
  
  -- Check if profile already exists
  SELECT id INTO existing_profile_id
  FROM users
  WHERE id = NEW.id;
  
  -- Only insert if profile doesn't exist
  IF existing_profile_id IS NULL THEN
    -- Check if this is the admin email
    IF NEW.email = 'gianluca@njordgear.com' THEN
      -- Insert admin user record
      INSERT INTO users (id, email, name, role, workspace_id, project_access)
      VALUES (NEW.id, NEW.email, 'Admin User', 'admin', default_workspace_id, NULL);
    ELSE
      -- Regular user signup (employee by default)
      INSERT INTO users (id, email, name, role, workspace_id, project_access)
      VALUES (NEW.id, NEW.email, 'New User', 'employee', default_workspace_id, '{}');
    END IF;
  ELSE
    -- Update existing profile if it's the admin email
    IF NEW.email = 'gianluca@njordgear.com' THEN
      UPDATE users 
      SET role = 'admin',
          workspace_id = default_workspace_id,
          updated_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail auth signup if user record creation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Add comments for documentation
COMMENT ON COLUMN users.name IS 'Full name of the user';
COMMENT ON COLUMN users.project_access IS 'Array of project IDs that employee users have access to';
COMMENT ON FUNCTION user_has_project_access(uuid, uuid) IS 'Check if user has access to a specific project';
COMMENT ON FUNCTION create_employee_account(text, text, uuid, uuid[]) IS 'Create new employee account (admin only)';
COMMENT ON FUNCTION update_user_project_access(uuid, uuid[]) IS 'Update user project access permissions (admin only)';
COMMENT ON FUNCTION get_user_permissions(uuid) IS 'Get comprehensive user permissions summary';