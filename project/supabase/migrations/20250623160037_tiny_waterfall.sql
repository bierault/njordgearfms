/*
  # Setup Admin User and Authentication System

  1. Workspace Setup
    - Ensure default workspace exists for admin
    - Create workspace if it doesn't exist

  2. Admin User Functions
    - Function to handle admin user setup
    - Trigger to automatically assign admin role to specific email
    - Update existing user creation trigger

  3. Security
    - Proper permissions for auth schema access
    - Secure function definitions
    - Error handling for user creation
*/

-- Ensure default workspace exists (use WHERE NOT EXISTS to avoid conflicts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'General') THEN
    INSERT INTO workspaces (name, description, color)
    VALUES ('General', 'Default workspace for admin', '#3B82F6');
  ELSE
    UPDATE workspaces 
    SET description = 'Default workspace for admin',
        color = '#3B82F6',
        updated_at = now()
    WHERE name = 'General';
  END IF;
END $$;

-- Create a function to set up admin user when they sign up
CREATE OR REPLACE FUNCTION setup_admin_user(user_email text)
RETURNS void AS $$
DECLARE
  default_workspace_id uuid;
  existing_user_id uuid;
  existing_profile_id uuid;
BEGIN
  -- Get default workspace
  SELECT id INTO default_workspace_id 
  FROM workspaces 
  WHERE name = 'General' 
  LIMIT 1;
  
  -- Check if user already exists in auth.users
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = user_email;
  
  -- If user exists, check if profile exists
  IF existing_user_id IS NOT NULL THEN
    SELECT id INTO existing_profile_id
    FROM users
    WHERE id = existing_user_id;
    
    IF existing_profile_id IS NOT NULL THEN
      -- Update existing profile
      UPDATE users 
      SET role = 'admin',
          workspace_id = default_workspace_id,
          updated_at = now()
      WHERE id = existing_user_id;
    ELSE
      -- Create new profile
      INSERT INTO users (id, email, role, workspace_id)
      VALUES (existing_user_id, user_email, 'admin', default_workspace_id);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically set admin role for specific email
CREATE OR REPLACE FUNCTION handle_admin_signup()
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
  
  -- Check if profile already exists
  SELECT id INTO existing_profile_id
  FROM users
  WHERE id = NEW.id;
  
  -- Only insert if profile doesn't exist
  IF existing_profile_id IS NULL THEN
    -- Check if this is the admin email
    IF NEW.email = 'gianluca@njordgear.com' THEN
      -- Insert admin user record
      INSERT INTO users (id, email, role, workspace_id)
      VALUES (NEW.id, NEW.email, 'admin', default_workspace_id);
    ELSE
      -- Regular user signup (existing logic)
      INSERT INTO users (id, email, role, workspace_id)
      VALUES (NEW.id, NEW.email, 'employee', default_workspace_id);
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

-- Update the existing trigger to use the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_admin_signup();

-- Grant necessary permissions (only if they don't already exist)
DO $$
BEGIN
  -- Grant schema usage permissions
  GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
  
  -- Grant table permissions
  GRANT ALL ON auth.users TO postgres, service_role;
  GRANT SELECT ON auth.users TO anon, authenticated;
  
EXCEPTION WHEN OTHERS THEN
  -- Ignore permission errors if they already exist
  NULL;
END $$;

-- Create a helper function to manually promote users to admin
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email text)
RETURNS boolean AS $$
DECLARE
  user_id uuid;
  default_workspace_id uuid;
  rows_updated integer;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN false; -- User not found
  END IF;
  
  -- Get default workspace
  SELECT id INTO default_workspace_id 
  FROM workspaces 
  WHERE name = 'General' 
  LIMIT 1;
  
  -- Update user role
  UPDATE users 
  SET role = 'admin',
      workspace_id = default_workspace_id,
      updated_at = now()
  WHERE id = user_id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- If no rows updated, try to insert
  IF rows_updated = 0 THEN
    INSERT INTO users (id, email, role, workspace_id)
    VALUES (user_id, user_email, 'admin', default_workspace_id);
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;