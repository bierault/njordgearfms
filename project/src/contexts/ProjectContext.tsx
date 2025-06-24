import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, Folder, ProjectContextType, ProjectStats } from '../types/project';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [folderTree, setFolderTree] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentWorkspace } = useWorkspace();

  // Load projects when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadProjects();
    } else {
      setProjects([]);
      setCurrentProject(null);
      setFolders([]);
      setFolderTree([]);
      setCurrentFolder(null);
    }
  }, [currentWorkspace]);

  // Load folders when project changes
  useEffect(() => {
    if (currentProject) {
      loadFolders();
    } else {
      setFolders([]);
      setFolderTree([]);
      setCurrentFolder(null);
    }
  }, [currentProject]);

  // Build folder tree when folders change
  useEffect(() => {
    if (folders.length > 0) {
      setFolderTree(buildFolderTree(folders));
    } else {
      setFolderTree([]);
    }
  }, [folders]);

  const loadProjects = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Loading projects for workspace:', currentWorkspace.id);

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      if (fetchError) throw fetchError;

      console.log('Projects loaded:', data?.length || 0);
      setProjects(data || []);

      // Set current project from localStorage or first project
      const savedProjectId = localStorage.getItem(`currentProjectId_${currentWorkspace.id}`);
      if (savedProjectId && data?.find(p => p.id === savedProjectId)) {
        setCurrentProject(data.find(p => p.id === savedProjectId) || null);
      } else if (data && data.length > 0) {
        setCurrentProject(data[0]);
      } else {
        setCurrentProject(null);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!currentProject) return;

    try {
      console.log('Loading folders for project:', currentProject.id);

      const { data, error: fetchError } = await supabase
        .from('folders')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('path');

      if (fetchError) throw fetchError;

      console.log('Folders loaded:', data?.length || 0);

      // Add file counts to folders
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count } = await supabase
            .from('files')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id)
            .is('deleted_at', null);

          return {
            ...folder,
            fileCount: count || 0
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (err) {
      console.error('Error loading folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  };

  const buildFolderTree = (folders: Folder[]): Folder[] => {
    const folderMap = new Map<string, Folder>();
    const rootFolders: Folder[] = [];

    // Create a map of all folders
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build the tree structure
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id)!;
      
      if (folder.parent_id) {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });

    return rootFolders;
  };

  const switchProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project && currentWorkspace) {
      console.log('Switching to project:', project.name);
      setCurrentProject(project);
      setCurrentFolder(null); // Reset folder when switching projects
      localStorage.setItem(`currentProjectId_${currentWorkspace.id}`, projectId);
    }
  };

  const switchFolder = (folderId: string | null) => {
    console.log('Switching to folder:', folderId);
    if (folderId) {
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        console.log('Found folder:', folder.name);
        setCurrentFolder(folder);
      } else {
        console.warn('Folder not found:', folderId);
        setCurrentFolder(null);
      }
    } else {
      console.log('Switching to project root');
      setCurrentFolder(null);
    }
  };

  const createProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> => {
    try {
      console.log('Creating project:', projectData.name, 'in workspace:', projectData.workspace_id);

      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (error) throw error;

      const newProject = data as Project;
      setProjects(prev => [...prev, newProject]);
      console.log('Project created successfully:', newProject.id);
      return newProject;
    } catch (err) {
      console.error('Error creating project:', err);
      throw err;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      ));

      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));

      if (currentProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        setCurrentProject(remainingProjects[0] || null);
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      throw err;
    }
  };

  const createFolder = async (folderData: Omit<Folder, 'id' | 'created_at' | 'updated_at' | 'path'>): Promise<Folder> => {
    try {
      console.log('Creating folder:', folderData.name, 'in project:', folderData.project_id);

      const { data, error } = await supabase
        .from('folders')
        .insert([folderData])
        .select()
        .single();

      if (error) throw error;

      const newFolder = data as Folder;
      await loadFolders(); // Reload to get updated paths and counts
      console.log('Folder created successfully:', newFolder.id);
      return newFolder;
    } catch (err) {
      console.error('Error creating folder:', err);
      throw err;
    }
  };

  const updateFolder = async (folderId: string, updates: Partial<Folder>) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', folderId);

      if (error) throw error;

      await loadFolders(); // Reload to get updated paths
    } catch (err) {
      console.error('Error updating folder:', err);
      throw err;
    }
  };

  const deleteFolder = async (folderId: string) => {
    try {
      console.log('Deleting folder:', folderId);

      // Get folder details before deletion
      const folderToDelete = folders.find(f => f.id === folderId);
      if (!folderToDelete) {
        throw new Error('Folder not found');
      }

      // Find the target location for files (parent folder or project root)
      const targetFolderId = folderToDelete.parent_id;
      const targetProjectId = folderToDelete.project_id;

      console.log('Moving files from deleted folder to:', targetFolderId ? 'parent folder' : 'project root');

      // Move all files from this folder to the parent folder or project root
      const { error: moveFilesError } = await supabase
        .from('files')
        .update({
          folder_id: targetFolderId,
          project_id: targetProjectId
        })
        .eq('folder_id', folderId);

      if (moveFilesError) {
        console.error('Error moving files:', moveFilesError);
        throw new Error(`Failed to move files: ${moveFilesError.message}`);
      }

      // Move all subfolders to the parent folder or project root
      const { error: moveSubfoldersError } = await supabase
        .from('folders')
        .update({
          parent_id: targetFolderId
        })
        .eq('parent_id', folderId);

      if (moveSubfoldersError) {
        console.error('Error moving subfolders:', moveSubfoldersError);
        throw new Error(`Failed to move subfolders: ${moveSubfoldersError.message}`);
      }

      // Delete the folder
      const { error: deleteError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (deleteError) {
        console.error('Error deleting folder:', deleteError);
        throw new Error(`Failed to delete folder: ${deleteError.message}`);
      }

      // If we're currently in the deleted folder, navigate to parent or project root
      if (currentFolder?.id === folderId) {
        setCurrentFolder(targetFolderId ? folders.find(f => f.id === targetFolderId) || null : null);
      }

      // Reload folders to update the tree
      await loadFolders();
      
      console.log('Folder deleted successfully, files and subfolders moved to target location');
    } catch (err) {
      console.error('Error deleting folder:', err);
      throw err;
    }
  };

  const moveFolder = async (folderId: string, newParentId: string | null) => {
    try {
      console.log('Moving folder:', folderId, 'to parent:', newParentId);

      // Prevent moving folder into itself
      if (folderId === newParentId) {
        throw new Error('Cannot move folder into itself');
      }

      // Check if target is a child of the folder being moved
      const isChildOfMovedFolder = (targetId: string | null, movedFolderId: string): boolean => {
        if (!targetId) return false;
        
        const targetFolder = folders.find(f => f.id === targetId);
        if (!targetFolder) return false;
        
        if (targetFolder.parent_id === movedFolderId) return true;
        
        return isChildOfMovedFolder(targetFolder.parent_id, movedFolderId);
      };

      if (newParentId && isChildOfMovedFolder(newParentId, folderId)) {
        throw new Error('Cannot move folder into its own subfolder');
      }

      const { error } = await supabase
        .from('folders')
        .update({ parent_id: newParentId })
        .eq('id', folderId);

      if (error) throw error;

      await loadFolders(); // Reload to get updated tree structure
      console.log('Folder moved successfully');
    } catch (err) {
      console.error('Error moving folder:', err);
      throw err;
    }
  };

  const getFolderPath = (folderId: string): string[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    
    // Split the path and filter out empty strings
    const pathParts = folder.path.split('/').filter(part => part.trim() !== '');
    return pathParts;
  };

  const getProjectStats = async (projectId: string): Promise<ProjectStats> => {
    try {
      // Get total files
      const { count: totalFiles } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .is('deleted_at', null);

      // Get total folders
      const { count: totalFolders } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      // Get files with details for size and type analysis
      const { data: files } = await supabase
        .from('files')
        .select('file_size, file_category, updated_at')
        .eq('project_id', projectId)
        .is('deleted_at', null);

      const totalSize = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
      
      const filesByType = files?.reduce((acc, file) => {
        acc[file.file_category] = (acc[file.file_category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentActivity = files?.filter(file => 
        new Date(file.updated_at) > sevenDaysAgo
      ).length || 0;

      return {
        totalFiles: totalFiles || 0,
        totalFolders: totalFolders || 0,
        totalSize,
        filesByType,
        recentActivity
      };
    } catch (err) {
      console.error('Error getting project stats:', err);
      return {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        filesByType: {},
        recentActivity: 0
      };
    }
  };

  const value: ProjectContextType = {
    currentProject,
    projects,
    folders,
    currentFolder,
    folderTree,
    loading,
    error,
    switchProject,
    createProject,
    updateProject,
    deleteProject,
    switchFolder,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    getFolderPath,
    getProjectStats,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};