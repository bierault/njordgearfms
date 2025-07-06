/*
  # Create users table with role-based access control

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, user email)
      - `role` (text, admin or employee)
      - `workspace_id` (uuid, references workspaces)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on users table
    - Users can read/update their own profile
    - Admins can manage users in their workspace
    - Automatic user creation on auth signup

  3. Performance
    - Indexes for email, workspace_id, role lookups
    - Composite indexes for common queries

  4. Automation
    - Trigger to create user record on auth signup
    - Default workspace assignment for new users
*/

-- Create users table
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

-- Create policies for users table
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
CREATE INDEX IF NOT EXISTS users_workspace_id_idx ON users(workspace_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_workspace_role_idx ON users(workspace_id, role);

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_workspace_id uuid;
BEGIN
  -- Get the first available workspace or create one
  SELECT id INTO default_workspace_id FROM workspaces LIMIT 1;
  
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
    'employee', -- Default role
    default_workspace_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Note: Admin users will be created through the normal signup process
-- The first user to sign up for each workspace can be manually promoted to admin
-- or admins can be created through the application interface after authentication