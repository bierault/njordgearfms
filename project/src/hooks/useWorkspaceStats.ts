import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

export interface WorkspaceStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  recentFiles: number;
  favoriteFiles: number;
  totalProjects: number;
  totalFolders: number;
}

export const useWorkspaceStats = () => {
  const [stats, setStats] = useState<WorkspaceStats>({
    totalFiles: 0,
    totalSize: 0,
    filesByType: {},
    recentFiles: 0,
    favoriteFiles: 0,
    totalProjects: 0,
    totalFolders: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentWorkspace } = useWorkspace();

  const loadStats = useCallback(async () => {
    if (!currentWorkspace) {
      setStats({
        totalFiles: 0,
        totalSize: 0,
        filesByType: {},
        recentFiles: 0,
        favoriteFiles: 0,
        totalProjects: 0,
        totalFolders: 0
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all files for the workspace
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('file_size, file_category, is_favorite, updated_at')
        .eq('workspace_id', currentWorkspace.id);

      if (filesError) throw filesError;

      // Get projects count
      const { count: projectsCount, error: projectsError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      if (projectsError) throw projectsError;

      // Get folders count (across all projects in workspace)
      const { count: foldersCount, error: foldersError } = await supabase
        .from('folders')
        .select('folders.*, projects!inner(workspace_id)', { count: 'exact', head: true })
        .eq('projects.workspace_id', currentWorkspace.id);

      if (foldersError) throw foldersError;

      // Calculate stats
      const totalFiles = files?.length || 0;
      const totalSize = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
      
      const filesByType = files?.reduce((acc, file) => {
        acc[file.file_category] = (acc[file.file_category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const favoriteFiles = files?.filter(file => file.is_favorite).length || 0;

      // Recent files (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentFiles = files?.filter(file => 
        new Date(file.updated_at) > sevenDaysAgo
      ).length || 0;

      setStats({
        totalFiles,
        totalSize,
        filesByType,
        recentFiles,
        favoriteFiles,
        totalProjects: projectsCount || 0,
        totalFolders: foldersCount || 0
      });

    } catch (err) {
      console.error('Error loading workspace stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspace stats');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Real-time updates
  useEffect(() => {
    if (!currentWorkspace) return;

    const channel = supabase
      .channel(`workspace_stats_${currentWorkspace.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'files',
          filter: `workspace_id=eq.${currentWorkspace.id}`
        }, 
        () => {
          // Debounce stats reload
          setTimeout(loadStats, 1000);
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'projects',
          filter: `workspace_id=eq.${currentWorkspace.id}`
        }, 
        () => {
          setTimeout(loadStats, 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace, loadStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: loadStats
  };
};