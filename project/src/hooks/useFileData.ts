import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, FileRecord } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useProject } from '../contexts/ProjectContext';
import { markFilesAsUpdated } from '../contexts/WorkspaceContext';

export interface FileItem {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  size: string;
  modifiedDate: string;
  thumbnail?: string;
  isFavorite?: boolean;
  tags?: string[];
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
  workspaceId: string;
  projectId?: string;
  folderId?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const convertFileRecord = (record: FileRecord): FileItem => ({
  id: record.id,
  name: record.name,
  type: record.file_category,
  size: formatFileSize(record.file_size),
  modifiedDate: new Date(record.updated_at).toLocaleDateString(),
  thumbnail: record.thumbnail_url || undefined,
  isFavorite: record.is_favorite,
  tags: record.tags || [],
  originalName: record.original_name,
  filePath: record.file_path,
  fileType: record.file_type,
  fileSize: record.file_size,
  fileUrl: record.file_url || undefined,
  workspaceId: record.workspace_id,
  projectId: record.project_id || undefined,
  folderId: record.folder_id || undefined,
});

const ITEMS_PER_PAGE = 20;

export const useFileData = (projectContext: boolean = false) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  const loadingRef = useRef(false);
  const currentPageRef = useRef(currentPage);

  const { currentWorkspace } = useWorkspace();
  const { currentProject, currentFolder } = useProject();

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const loadFiles = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!currentWorkspace?.id || loadingRef.current) {
      setFiles([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    try {
      loadingRef.current = true;
      if (!append) {
        setLoading(true);
      }
      setError(null);

      console.log('=== Loading Files (Workspace Scoped) ===');
      console.log('Workspace:', currentWorkspace.name, currentWorkspace.id);
      console.log('Project Context:', projectContext);
      console.log('Current Project:', currentProject?.name || 'None');
      console.log('Current Folder:', currentFolder?.name || 'None');
      console.log('Page:', page);

      // Build workspace-scoped query
      let query = supabase
        .from('files')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null);

      let countQuery = supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null);

      // Apply project/folder filtering when in project context
      if (projectContext) {
        if (currentProject) {
          console.log('Filtering by project:', currentProject.id);
          query = query.eq('project_id', currentProject.id);
          countQuery = countQuery.eq('project_id', currentProject.id);
          
          if (currentFolder) {
            console.log('Filtering by folder:', currentFolder.id);
            query = query.eq('folder_id', currentFolder.id);
            countQuery = countQuery.eq('folder_id', currentFolder.id);
          } else {
            console.log('Showing project root files (no folder)');
            query = query.is('folder_id', null);
            countQuery = countQuery.is('folder_id', null);
          }
        } else {
          console.log('No project selected in project context - showing empty');
          setFiles([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      } else {
        console.log('Main view - showing all workspace files');
      }

      // Get total count
      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Count query error:', countError);
        throw countError;
      }

      const totalFiles = count || 0;
      setTotalCount(totalFiles);
      console.log('Total files found:', totalFiles);

      // Calculate pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Fetch paginated data
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) {
        console.error('Fetch query error:', fetchError);
        throw fetchError;
      }

      console.log('Files fetched:', data?.length || 0);
      const convertedFiles = (data || []).map(convertFileRecord);
      
      if (append) {
        setFiles(prev => [...prev, ...convertedFiles]);
      } else {
        setFiles(convertedFiles);
      }

      // Update pagination state
      setCurrentPage(page);
      setHasNextPage(to < totalFiles - 1);
      setHasPrevPage(page > 1);

    } catch (err) {
      console.error('Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [currentWorkspace, currentProject, currentFolder, projectContext]);

  // Load files when workspace or context changes
  useEffect(() => {
    console.log('=== Context Changed - Reloading Files ===');
    if (currentWorkspace?.id) {
      setCurrentPage(1);
      loadFiles(1);
    }
  }, [currentWorkspace, currentProject, currentFolder, projectContext, loadFiles]);

  // Real-time subscription for workspace-scoped changes
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel(`files_changes_${currentWorkspace.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'files',
          filter: `workspace_id=eq.${currentWorkspace.id}`
        }, 
        (payload) => {
          console.log('Real-time update received:', payload);
          if (!loadingRef.current) {
            setTimeout(() => {
              loadFiles(currentPageRef.current);
            }, 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace, loadFiles]);

  const nextPage = useCallback(() => {
    if (hasNextPage && !loadingRef.current) {
      loadFiles(currentPage + 1);
    }
  }, [hasNextPage, currentPage, loadFiles]);

  const prevPage = useCallback(() => {
    if (hasPrevPage && !loadingRef.current) {
      loadFiles(currentPage - 1);
    }
  }, [hasPrevPage, currentPage, loadFiles]);

  const goToPage = useCallback((page: number) => {
    const maxPage = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (page >= 1 && page <= maxPage && !loadingRef.current) {
      loadFiles(page);
    }
  }, [totalCount, loadFiles]);

  const addFiles = useCallback((newFiles: FileRecord[]) => {
    if (!currentWorkspace?.id) return;

    console.log('Adding files to state:', newFiles.length);
    // Only add files that belong to current workspace
    let filteredFiles = newFiles.filter(f => f.workspace_id === currentWorkspace.id);
    
    // If we're in project context, also filter by project/folder
    if (projectContext && currentProject) {
      filteredFiles = filteredFiles.filter(f => f.project_id === currentProject.id);
      if (currentFolder) {
        filteredFiles = filteredFiles.filter(f => f.folder_id === currentFolder.id);
      } else {
        filteredFiles = filteredFiles.filter(f => !f.folder_id);
      }
    }
    
    const convertedFiles = filteredFiles.map(convertFileRecord);
    
    setFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const uniqueNewFiles = convertedFiles.filter(f => !existingIds.has(f.id));
      return [...uniqueNewFiles, ...prev];
    });
    setTotalCount(prev => prev + convertedFiles.length);
  }, [currentWorkspace, currentProject, currentFolder, projectContext]);

  const removeFile = useCallback(async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      console.log('Removing file:', fileId);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([file.filePath]);

      if (storageError) {
        console.warn('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      setFiles(prev => prev.filter(file => file.id !== fileId));
      setTotalCount(prev => prev - 1);
      
      markFilesAsUpdated();
    } catch (err) {
      console.error('Error removing file:', err);
      throw err;
    }
  }, [files]);

  const updateFile = useCallback(async (fileId: string, updates: Partial<FileItem>) => {
    try {
      const dbUpdates: Partial<FileRecord> = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
      if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId || null;
      if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId || null;
      if (updates.fileUrl !== undefined) dbUpdates.file_url = updates.fileUrl || null;

      const { error } = await supabase
        .from('files')
        .update(dbUpdates)
        .eq('id', fileId);

      if (error) throw error;

      // Update local state immediately for better UX
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, ...updates } : file
      ));

      markFilesAsUpdated();

    } catch (err) {
      console.error('Error updating file:', err);
      throw err;
    }
  }, []);

  const toggleFavorite = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    await updateFile(fileId, { isFavorite: !file.isFavorite });
  }, [files, updateFile]);

  const refreshFiles = useCallback(() => {
    console.log('Refreshing files...');
    if (!loadingRef.current) {
      loadFiles(currentPage);
    }
  }, [loadFiles, currentPage]);

  return {
    files,
    loading,
    error,
    currentPage,
    totalCount,
    hasNextPage,
    hasPrevPage,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
    addFiles,
    removeFile,
    updateFile,
    toggleFavorite,
    refreshFiles,
    nextPage,
    prevPage,
    goToPage,
  };
};