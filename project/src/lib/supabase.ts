import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface FileRecord {
  id: string;
  name: string;
  original_name: string;
  file_path: string;
  file_type: string;
  file_category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  file_size: number;
  file_url?: string; // Added for n8n automation integration
  thumbnail_url?: string;
  tags: string[];
  is_favorite: boolean;
  workspace_id: string;
  project_id?: string;
  folder_id?: string;
  user_id?: string; // Made optional for anonymous uploads
  deleted_at?: string; // Added for soft delete
  deleted_by?: string; // Added to track who deleted
  original_project_id?: string; // Added for restoration
  original_folder_id?: string; // Added for restoration
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  color: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  parent_id?: string;
  project_id: string;
  path: string;
  created_at: string;
  updated_at: string;
}