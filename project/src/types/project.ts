export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  project_id: string;
  path: string;
  created_at: string;
  updated_at: string;
  children?: Folder[];
  fileCount?: number;
}

export interface ProjectStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  filesByType: Record<string, number>;
  recentActivity: number;
}

export interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  folders: Folder[];
  currentFolder: Folder | null;
  folderTree: Folder[];
  loading: boolean;
  error: string | null;
  
  // Project operations
  switchProject: (projectId: string) => void;
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<Project>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  
  // Folder operations
  switchFolder: (folderId: string | null) => void;
  createFolder: (folder: Omit<Folder, 'id' | 'created_at' | 'updated_at' | 'path'>) => Promise<Folder>;
  updateFolder: (folderId: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  
  // Utility functions
  getFolderPath: (folderId: string) => string[];
  getProjectStats: (projectId: string) => Promise<ProjectStats>;
}