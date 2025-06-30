import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, Folder, ProjectContextType, ProjectStats } from '../types/project';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';

// Default context values to prevent crashes
const defaultProjectContext: ProjectContextType = {
  currentProject: null,
  projects: [],
  folders: [],
  currentFolder: null,
  folderTree: [],
  loading: true,
  error: null,
  switchProject: () => {},
  createProject: async () => ({ id: '', name: '', color: '', workspace_id: '', created_at: '', updated_at: '' }),
  updateProject: async () => {},
  deleteProject: async () => {},
  switchFolder: () => {},
  createFolder: async () => ({ id: '', name: '', project_id: '', path: '', created_at: '', updated_at: '' }),
  updateFolder: async () => {},
  deleteFolder: async () => {},
  moveFolder: async () => {},
  getFolderPath: () => [],
  getProjectStats: async () => ({ totalFiles: 0, totalFolders: 0, totalSize: 0, filesByType: {}, recentActivity: 0 }),
};

const ProjectContext = createContext<ProjectContextType>(defaultProjectContext);

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
  const [initialized, setInitialized] = useState(false);

  const { currentWorkspace } = useWorkspace();

  // Load projects when workspace changes
  useEffect(() => {
    let isMounted = true;

    const initializeProjects = async () => {
      if (!currentWorkspace?.id) {
        // Reset state when no workspace
        if (isMounted) {
          setProjects([]);
          setCurrentProject(null);
          setFolders([]);
          setFolderTree([]);
          setCurrentFolder(null);
          setLoading(false);
          setError(null);
          setInitialized(true);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        await loadProjects();
        
        if (isMounted) {
          setInitialized(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to initialize projects:', err);
          setError(err instanceof Error ? err.message : 'Failed to load projects');
          setInitialized(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeProjects();

    return () => {
      isMounted = false;
    };
  }, [currentWorkspace]);

  // Load folders when project changes
  useEffect(() => {
    let isMounted = true;

    const initializeFolders = async () => {
      if (!currentProject?.id) {
        if (isMounted) {
          setFolders([]);
          setFolderTree([]);
          setCurrentFolder(null);
        }
        return;
      }

      try {
        await loadFolders();
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load folders:', err);
          setError(err instanceof Error ? err.message : 'Failed to load folders');
        }
      }
    };

    if (initialized) {
      initializeFolders();
    }

    return () => {
      isMounted = false;
    };
  }, [currentProject, initialized]);

  // Build folder tree when folders change
  useEffect(() => {
    if (folders.length > 0) {
      try {
        const tree = buildFolderTree(folders);
        setFolderTree(tree);
      } catch (err) {
        console.error('Failed to build folder tree:', err);
        setFolderTree([]);
      }
    } else {
      setFolderTree([]);
    }
  }, [folders]);

  const loadProjects = async () => {
    if (!currentWorkspace?.id) {
      throw new Error('No workspace available');
    }

    try {
      console.log('Loading projects for workspace:', currentWorkspace.id);

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      if (fetchError) {
        console.error('Supabase error loading projects:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      const projectsData = data || [];
      console.log('Projects loaded:', projectsData.length);
      setProjects(projectsData);

      // Set current project from localStorage or first project
      try {
        const savedProjectId = localStorage.getItem(`currentProjectId_${currentWorkspace.id}`);
        if (savedProjectId && projectsData.find(p => p.id === savedProjectId)) {
          const savedProject = projectsData.find(p => p.id === savedProjectId);
          setCurrentProject(savedProject || null);
        } else if (projectsData.length > 0) {
          setCurrentProject(projectsData[0]);
        } else {
          setCurrentProject(null);
        }
      } catch (storageError) {
        console.warn('Error accessing localStorage:', storageError);
        // Fallback to first project if localStorage fails
        setCurrentProject(projectsData.length > 0 ? projectsData[0] : null);
      }
    } catch (err) {
      console.error('Error in loadProjects:', err);
      throw err;
    }
  };

  const loadFolders = async () => {
    if (!currentProject?.id) {
      throw new Error('No project available');
    }

    try {
      console.log('Loading folders for project:', currentProject.id);

      const { data, error: fetchError } = await supabase
        .from('folders')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('path');

      if (fetchError) {
        console.error('Supabase error loading folders:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      const foldersData = data || [];
      console.log('Folders loaded:', foldersData.length);

      // Add file counts to folders
      try {
        const foldersWithCounts = await Promise.all(
          foldersData.map(async (folder) => {
            try {
              const { count } = await supabase
                .from('files')
                .select('*', { count: 'exact', head: true })
                .eq('folder_id', folder.id)
                .is('deleted_at', null);

              return {
                ...folder,
                fileCount: count || 0
              };
            } catch (countError) {
              console.warn('Error getting file count for folder:', folder.id, countError);
              return {
                ...folder,
                fileCount: 0
              };
            }
          })
        );

        setFolders(foldersWithCounts);
      } catch (countError) {
        console.warn('Error adding file counts to folders:', countError);
        setFolders(foldersData);
      }
    } catch (err) {
      console.error('Error in loadFolders:', err);
      throw err;
    }
  };

  const buildFolderTree = (folders: Folder[]): Folder[] => {
    try {
      const folderMap = new Map<string, Folder>();
      const rootFolders: Folder[] = [];

      // Create a map of all folders
      folders.forEach(folder => {
        folderMap.set(folder.id, { ...folder, children: [] });
      });

      // Build the tree structure
      folders.forEach(folder => {
        const folderNode = folderMap.get(folder.id);
        if (!folderNode) return;
        
        if (folder.parent_id) {
          const parent = folderMap.get(folder.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(folderNode);
          } else {
            // Parent not found, treat as root folder
            rootFolders.push(folderNode);
          }
        } else {
          rootFolders.push(folderNode);
        }
      });

      return rootFolders;
    } catch (err) {
      console.error('Error building folder tree:', err);
      return [];
    }
  };

  const switchProject = (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (project && currentWorkspace?.id) {
        console.log('Switching to project:', project.name);
        setCurrentProject(project);
        setCurrentFolder(null); // Reset folder when switching projects
        localStorage.setItem(`currentProjectId_${currentWorkspace.id}`, projectId);
      } else {
        console.warn('Project not found or no workspace:', projectId);
      }
    } catch (err) {
      console.error('Error switching project:', err);
    }
  };

  const switchFolder = (folderId: string | null) => {
    try {
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
    } catch (err) {
      console.error('Error switching folder:', err);
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

      if (error) {
        console.error('Supabase error creating project:', error);
        throw new Error(`Failed to create project: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from project creation');
      }

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

      if (error) {
        console.error('Supabase error updating project:', error);
        throw new Error(`Failed to update project: ${error.message}`);
      }

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

      if (error) {
        console.error('Supabase error deleting project:', error);
        throw new Error(`Failed to delete project: ${error.message}`);
      }

      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);

      if (currentProject?.id === projectId) {
        setCurrentProject(updatedProjects.length > 0 ? updatedProjects[0] : null);
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

      if (error) {
        console.error('Supabase error creating folder:', error);
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from folder creation');
      }

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

      if (error) {
        console.error('Supabase error updating folder:', error);
        throw new Error(`Failed to update folder: ${error.message}`);
      }

      await loadFolders(); // Reload to get updated paths
    } catch (err) {
      console.error('Error updating folder:', err);
      throw err;
    }
  };

  const deleteFolder = async (folderId: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) {
        console.error('Supabase error deleting folder:', error);
        throw new Error(`Failed to delete folder: ${error.message}`);
      }

      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
      }

      await loadFolders();
    } catch (err) {
      console.error('Error deleting folder:', err);
      throw err;
    }
  };

  const moveFolder = async (folderId: string, newParentId: string | null) => {
    try {
      console.log('Moving folder:', folderId, 'to parent:', newParentId);

      // Prevent moving folder into itself or its children
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

      if (error) {
        console.error('Supabase error moving folder:', error);
        throw new Error(`Failed to move folder: ${error.message}`);
      }

      await loadFolders(); // Reload to get updated tree structure
      console.log('Folder moved successfully');
    } catch (err) {
      console.error('Error moving folder:', err);
      throw err;
    }
  };

  const getFolderPath = (folderId: string): string[] => {
    try {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return [];
      
      // Split the path and filter out empty strings
      const pathParts = folder.path.split('/').filter(part => part.trim() !== '');
      return pathParts;
    } catch (err) {
      console.error('Error getting folder path:', err);
      return [];
    }
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
  
  // Return default context if used outside provider (prevents crashes)
  if (!context) {
    console.warn('useProject must be used within a ProjectProvider. Returning default values.');
    return defaultProjectContext;
  }
  
  return context;
};