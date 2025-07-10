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

// Increased items per page for better dashboard experience
const ITEMS_PER_PAGE = 50;

export const useFileData = (projectContext: boolean = false, showTrash: boolean = false) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  // Server-side sorting state
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // View type for filtering
  const [activeView, setActiveView] = useState<string>('dashboard');

  const loadingRef = useRef(false);
  const currentPageRef = useRef(currentPage);

  const { currentWorkspace } = useWorkspace();
  const { currentProject, currentFolder } = useProject();

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const loadFiles = useCallback(async (
    page: number = 1, 
    append: boolean = false,
    sortField?: 'name' | 'date' | 'size' | 'type',
    sortDir?: 'asc' | 'desc',
    view?: string
  ) => {
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

      const currentView = view || activeView;
      setActiveView(currentView);

      console.log('=== Loading Files with Server-Side Sorting ===');
      console.log('Workspace:', currentWorkspace.name, currentWorkspace.id);
      console.log('Project Context:', projectContext);
      console.log('Current Project:', currentProject?.name || 'None');
      console.log('Current Folder:', currentFolder?.name || 'None');
      console.log('Page:', page);
      console.log('Sort:', sortField || sortBy, sortDir || sortDirection);
      console.log('View:', currentView);

      // Build workspace-scoped query - show ALL files in workspace regardless of user role
      let query = supabase
        .from('files')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null); // Only show active files

      let countQuery = supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null); // Only count active files

      // Apply view-specific filters
      if (currentView === 'favorites') {
        console.log('Filtering by favorites');
        query = query.eq('is_favorite', true);
        countQuery = countQuery.eq('is_favorite', true);
      } else if (currentView === 'recent') {
        console.log('Filtering by recent (last 7 days)');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();
        
        query = query.gte('updated_at', sevenDaysAgoStr);
        countQuery = countQuery.gte('updated_at', sevenDaysAgoStr);
      }

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
          loadingRef.current = false;
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

      // Apply server-side sorting
      const currentSortBy = sortField || sortBy;
      const currentSortDirection = sortDir || sortDirection;
      
      let orderColumn: string;
      let ascending: boolean;

      switch (currentSortBy) {
        case 'name':
          orderColumn = 'name';
          ascending = currentSortDirection === 'asc';
          break;
        case 'size':
          orderColumn = 'file_size';
          ascending = currentSortDirection === 'asc';
          break;
        case 'type':
          orderColumn = 'file_category';
          ascending = currentSortDirection === 'asc';
          break;
        case 'date':
        default:
          orderColumn = 'created_at';
          ascending = currentSortDirection === 'asc';
          break;
      }

      console.log('Applying server-side sort:', orderColumn, ascending ? 'ASC' : 'DESC');

      // Calculate pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Fetch paginated data with server-side sorting
      const { data, error: fetchError } = await query
        .order(orderColumn, { ascending })
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
  }, [currentWorkspace, currentProject, currentFolder, projectContext, sortBy, sortDirection, activeView]);

  // Load files when workspace or context changes
  useEffect(() => {
    console.log('=== Context Changed - Reloading Files ===');
    if (currentWorkspace?.id) {
      setCurrentPage(1);
      loadFiles(1);
    }
  }, [currentWorkspace, currentProject, currentFolder, projectContext, loadFiles]);

  // Real-time subscription for file changes
  const channelRef = useRef<any>(null);
  // Unique ID for this hook instance
  const channelInstanceId = useRef(Math.random().toString(36).substring(2));
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    // Always clean up previous channel before creating a new one
    if (channelRef.current) {
      console.log('[useFileData] Cleaning up previous channel', channelRef.current.topic);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Always create a new channel instance with a unique name
    const channelName = `files_changes_${currentWorkspace.id}_${channelInstanceId.current}`;
    console.log('[useFileData] Creating new channel:', channelName);
    const newChannel = supabase
      .channel(channelName)
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
      );

    // Subscribe only once per new channel instance
    newChannel.subscribe();
    channelRef.current = newChannel;

    return () => {
      if (channelRef.current) {
        console.log('[useFileData] Cleanup on unmount', channelRef.current.topic);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentWorkspace, loadFiles]);

  // Server-side sorting functions
  const handleSortChange = useCallback((newSortBy: 'name' | 'date' | 'size' | 'type', newSortDirection?: 'asc' | 'desc') => {
    const direction = newSortDirection || (newSortBy === sortBy && sortDirection === 'asc' ? 'desc' : 'asc');
    
    console.log('Changing sort:', newSortBy, direction);
    setSortBy(newSortBy);
    setSortDirection(direction);
    
    // Reset to first page and reload with new sorting
    setCurrentPage(1);
    loadFiles(1, false, newSortBy, direction);
  }, [sortBy, sortDirection, loadFiles]);

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
    // Only add files that belong to current workspace and are not deleted
    let filteredFiles = newFiles.filter(f => f.workspace_id === currentWorkspace.id && !f.deleted_at);
    
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

  const updateFile = useCallback(async (fileId: string, updates: Partial<FileItem>) => {
    try {
      const dbUpdates: Partial<FileRecord> = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.tags !== undefined) {
        // Normalize tags to lowercase and remove duplicates
        const normalizedTags = [...new Set(updates.tags.map(tag => tag.toLowerCase()))];
        dbUpdates.tags = normalizedTags;
      }
      if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
      if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId || undefined;
      if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId || undefined;
      if (updates.fileUrl !== undefined) dbUpdates.file_url = updates.fileUrl || undefined;

      console.log('Updating file:', fileId, 'with changes:', dbUpdates);

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

      // If we moved the file to a different project/folder, refresh to update the view
      if (updates.projectId !== undefined || updates.folderId !== undefined) {
        console.log('File moved, refreshing view');
        setTimeout(() => {
          loadFiles(currentPage, false, undefined, undefined, activeView);
        }, 100);
      }

    } catch (err) {
      console.error('Error updating file:', err);
      throw err;
    }
  }, [loadFiles, currentPage, activeView]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      console.log('DELETING FILE:', fileId);
      
      // Soft delete by setting deleted_at timestamp
      const { error } = await supabase
        .from('files')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: null // We don't have user ID in this context
        })
        .eq('id', fileId);

      if (error) {
        console.error('Supabase error deleting file:', error);
        throw error;
      }

      console.log('File soft deleted successfully in database');

      // Remove from local state immediately
      setFiles(prev => {
        const newFiles = prev.filter(file => file.id !== fileId);
        console.log('Removed file from local state. Files before:', prev.length, 'Files after:', newFiles.length);
        return newFiles;
      });
      
      setTotalCount(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log('Updated total count from', prev, 'to', newCount);
        return newCount;
      });

      markFilesAsUpdated();
      console.log('File deletion completed successfully');

    } catch (err) {
      console.error('Error deleting file:', err);
      throw err;
    }
  }, []);

  const toggleFavorite = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    await updateFile(fileId, { isFavorite: !file.isFavorite });
  }, [files, updateFile]);

  const refreshFiles = useCallback((view?: string) => {
    console.log('Refreshing files...', view ? `View: ${view}` : '');
    if (!loadingRef.current) {
      loadFiles(currentPage, false, undefined, undefined, view);
    }
  }, [loadFiles, currentPage]);

  const changeView = useCallback((view: string) => {
    console.log('Changing view to:', view);
    setActiveView(view);
    setCurrentPage(1);
    loadFiles(1, false, undefined, undefined, view);
  }, [loadFiles]);

  return {
    files,
    loading,
    error,
    currentPage,
    totalCount,
    hasNextPage,
    hasPrevPage,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
    sortBy,
    sortDirection,
    activeView,
    addFiles,
    updateFile,
    deleteFile,
    toggleFavorite,
    refreshFiles,
    changeView,
    nextPage,
    prevPage,
    goToPage,
    handleSortChange,
  };
};