export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  recentFiles: number;
  favoriteFiles: number;
}

export interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (workspace: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>) => Promise<Workspace>;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  duplicateFilesToWorkspace: (fileIds: string[], targetWorkspaceId: string) => Promise<void>;
  moveFilesToWorkspace: (fileIds: string[], targetWorkspaceId: string) => Promise<void>;
}