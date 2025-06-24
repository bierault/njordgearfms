/*
  # Fix User Authentication System

  1. User Management
    - Create users table with proper constraints
    - Set up RLS policies for user access
    - Create indexes for performance
    - Add trigger for automatic user creation

  2. Security
    - Enable RLS on users table
    - Allow users to read/update own profile
    - Allow admins to manage users in workspace
    - Secure function for user creation

  3. Performance
    - Optimized indexes for user lookups
    - Helper function for user data retrieval
    - Efficient workspace assignment logic
*/

-- Ensure users table exists with proper structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users in workspace" ON users;
DROP POLICY IF EXISTS "Admins can update users in workspace" ON users;
DROP POLICY IF EXISTS "Admins can insert users in workspace" ON users;
DROP POLICY IF EXISTS "Users can insert own record" ON users;

-- Create RLS policies
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
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users in workspace"
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

CREATE POLICY "Admins can update users in workspace"
  ON users
  FOR UPDATE
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
      AND admin_user.workspace_id = users.workspace_id
    )
  );

CREATE POLICY "Admins can insert users in workspace"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin' 
      AND admin_user.workspace_id = workspace_id
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_email_key ON users(email);
CREATE INDEX IF NOT EXISTS users_pkey ON users(id);
CREATE INDEX IF NOT EXISTS users_workspace_id_idx ON users(workspace_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_workspace_role_idx ON users(workspace_id, role);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create simplified function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_workspace_id uuid;
BEGIN
  -- Get the first available workspace
  SELECT id INTO default_workspace_id 
  FROM workspaces 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  -- If no workspace exists, create a default one
  IF default_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, description, color)
    VALUES ('Default Workspace', 'Default workspace for new users', '#3B82F6')
    RETURNING id INTO default_workspace_id;
  END IF;

  -- Insert user record
  INSERT INTO users (id, email, role, workspace_id)
  VALUES (
    NEW.id,
    NEW.email,
    'employee',
    default_workspace_id
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail auth signup if user record creation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create helper function for user data retrieval
CREATE OR REPLACE FUNCTION get_user_with_workspace(user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  workspace_id uuid,
  workspace_name text,
  workspace_color text,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.role,
    u.workspace_id,
    COALESCE(w.name, 'No Workspace') as workspace_name,
    COALESCE(w.color, '#3B82F6') as workspace_color,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN workspaces w ON u.workspace_id = w.id
  WHERE u.id = user_id;
END;
$$;