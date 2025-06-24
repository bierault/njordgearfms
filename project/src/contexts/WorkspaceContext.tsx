import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Workspace, WorkspaceContextType } from '../types/workspace';
import { supabase } from '../lib/supabase';

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

// Global state to track when files have been updated
let filesUpdatedFlag = false;
let lastUpdateTimestamp = 0;

// Function to mark files as updated
export const markFilesAsUpdated = () => {
  filesUpdatedFlag = true;
  lastUpdateTimestamp = Date.now();
  console.log('Files marked as updated at:', lastUpdateTimestamp);
};

// Function to check if files need refresh
export const shouldRefreshFiles = () => {
  return filesUpdatedFlag;
};

// Function to clear the update flag
export const clearFilesUpdateFlag = () => {
  filesUpdatedFlag = false;
  console.log('Files update flag cleared');
};

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load saved workspace preference
  useEffect(() => {
    const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    if (savedWorkspaceId && workspaces.length > 0) {
      const workspace = workspaces.find(w => w.id === savedWorkspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
      } else {
        // Fallback to first workspace if saved one doesn't exist
        setCurrentWorkspace(workspaces[0]);
        localStorage.setItem('currentWorkspaceId', workspaces[0].id);
      }
    } else if (workspaces.length > 0) {
      setCurrentWorkspace(workspaces[0]);
      localStorage.setItem('currentWorkspaceId', workspaces[0].id);
    }
  }, [workspaces]);

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('workspaces')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      // If no workspaces exist, create a default one
      if (!data || data.length === 0) {
        console.log('No workspaces found, creating default workspace...');
        const defaultWorkspace = await createWorkspace({
          name: 'My Workspace',
          description: 'Default workspace for your files',
          color: '#3B82F6'
        });
        setWorkspaces([defaultWorkspace]);
        setCurrentWorkspace(defaultWorkspace);
        localStorage.setItem('currentWorkspaceId', defaultWorkspace.id);
      } else {
        setWorkspaces(data || []);
      }
    } catch (err) {
      console.error('Error loading workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
      localStorage.setItem('currentWorkspaceId', workspaceId);
    }
  }, [workspaces]);

  const createWorkspace = useCallback(async (workspaceData: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>): Promise<Workspace> => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([workspaceData])
        .select()
        .single();

      if (error) throw error;

      const newWorkspace = data as Workspace;
      setWorkspaces(prev => [...prev, newWorkspace]);
      return newWorkspace;
    } catch (err) {
      console.error('Error creating workspace:', err);
      throw err;
    }
  }, []);

  const updateWorkspace = useCallback(async (workspaceId: string, updates: Partial<Workspace>) => {
    try {
      const { error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspaces(prev => prev.map(w => 
        w.id === workspaceId ? { ...w, ...updates } : w
      ));

      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Error updating workspace:', err);
      throw err;
    }
  }, [currentWorkspace]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));

      if (currentWorkspace?.id === workspaceId) {
        const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId);
        if (remainingWorkspaces.length > 0) {
          setCurrentWorkspace(remainingWorkspaces[0]);
          localStorage.setItem('currentWorkspaceId', remainingWorkspaces[0].id);
        } else {
          setCurrentWorkspace(null);
          localStorage.removeItem('currentWorkspaceId');
        }
      }
    } catch (err) {
      console.error('Error deleting workspace:', err);
      throw err;
    }
  }, [currentWorkspace, workspaces]);

  const duplicateFilesToWorkspace = useCallback(async (fileIds: string[], targetWorkspaceId: string) => {
    try {
      // Get the files to duplicate
      const { data: filesToDuplicate, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .in('id', fileIds);

      if (fetchError) throw fetchError;

      // Create new file records with new IDs and target workspace
      const duplicatedFiles = filesToDuplicate.map(file => ({
        ...file,
        id: undefined, // Let database generate new ID
        workspace_id: targetWorkspaceId,
        name: `${file.name} (Copy)`,
        created_at: undefined,
        updated_at: undefined,
      }));

      const { error: insertError } = await supabase
        .from('files')
        .insert(duplicatedFiles);

      if (insertError) throw insertError;

      console.log(`Successfully duplicated ${fileIds.length} files to workspace ${targetWorkspaceId}`);
    } catch (err) {
      console.error('Error duplicating files:', err);
      throw err;
    }
  }, []);

  const moveFilesToWorkspace = useCallback(async (fileIds: string[], targetWorkspaceId: string) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ workspace_id: targetWorkspaceId })
        .in('id', fileIds);

      if (error) throw error;

      console.log(`Successfully moved ${fileIds.length} files to workspace ${targetWorkspaceId}`);
    } catch (err) {
      console.error('Error moving files:', err);
      throw err;
    }
  }, []);

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    loading,
    error,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    duplicateFilesToWorkspace,
    moveFilesToWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};