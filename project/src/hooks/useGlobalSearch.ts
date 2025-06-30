import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { FileItem } from '../components/FileCard';

interface GlobalSearchResult {
  files: FileItem[];
  loading: boolean;
  error: string | null;
  totalResults: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const convertFileRecord = (record: any): FileItem => ({
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

// Smart search function that handles fuzzy/lazy matching
const buildSmartSearchQuery = (query: string) => {
  if (!query || query.length < 2) return null;
  
  const cleanQuery = query.trim().toLowerCase();
  
  // Split query into words for better matching
  const words = cleanQuery.split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return null;
  
  // Create fuzzy search patterns
  const searchPatterns = [];
  
  // 1. Exact phrase match (highest priority)
  searchPatterns.push(`%${cleanQuery}%`);
  
  // 2. All words present (any order)
  if (words.length > 1) {
    words.forEach(word => {
      searchPatterns.push(`%${word}%`);
    });
  }
  
  // 3. Partial word matches for single words
  if (words.length === 1) {
    const word = words[0];
    if (word.length >= 3) {
      // Add partial matches for longer words
      for (let i = 3; i <= word.length; i++) {
        const partial = word.substring(0, i);
        searchPatterns.push(`%${partial}%`);
      }
    }
  }
  
  return {
    patterns: searchPatterns,
    words: words,
    originalQuery: cleanQuery
  };
};

export const useGlobalSearch = (query: string, selectedTags: string[] = [], activeView?: string): GlobalSearchResult => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  
  const { currentWorkspace } = useWorkspace();

  // Smart search function with lazy matching
  const searchFiles = useCallback(async (searchQuery: string, tags: string[], view?: string) => {
    if (!currentWorkspace?.id) {
      setFiles([]);
      setTotalResults(0);
      return;
    }

    // Don't search for very short queries
    if (searchQuery.trim().length === 0 && tags.length === 0) {
      setFiles([]);
      setTotalResults(0);
      setLoading(false);
      return;
    }

    if (searchQuery.trim().length > 0 && searchQuery.trim().length < 2) {
      setFiles([]);
      setTotalResults(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('=== Smart Global Search ===');
      console.log('Query:', searchQuery);
      console.log('Tags:', tags);
      console.log('View:', view || 'all');
      console.log('Workspace:', currentWorkspace.id);

      // Build smart search patterns
      const searchInfo = buildSmartSearchQuery(searchQuery);
      
      // Start with base query
      let searchQueryBuilder = supabase
        .from('files')
        .select('*', { count: 'exact' })
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null); // Only active files

      // Apply view-specific filters
      if (view === 'favorites') {
        searchQueryBuilder = searchQueryBuilder.eq('is_favorite', true);
      } else if (view === 'recent') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();
        
        searchQueryBuilder = searchQueryBuilder.gte('updated_at', sevenDaysAgoStr);
      }

      // Apply smart text search if query exists
      if (searchInfo && searchInfo.patterns.length > 0) {
        const { patterns, words } = searchInfo;
        
        // Build OR conditions for flexible matching
        const searchConditions = [];
        
        // Search in file names (both name and original_name)
        patterns.forEach(pattern => {
          searchConditions.push(`name.ilike.${pattern}`);
          searchConditions.push(`original_name.ilike.${pattern}`);
        });
        
        // Search in tags array - check if any tag contains the search terms
        words.forEach(word => {
          searchConditions.push(`tags.cs.{${word}}`);
        });
        
        // Apply the OR search conditions
        if (searchConditions.length > 0) {
          searchQueryBuilder = searchQueryBuilder.or(searchConditions.join(','));
        }
      }

      // Apply tag filters if tags are selected
      if (tags.length > 0) {
        // For each selected tag, ensure the file has that tag
        tags.forEach(tag => {
          searchQueryBuilder = searchQueryBuilder.contains('tags', [tag]);
        });
      }

      // Order by recency
      searchQueryBuilder = searchQueryBuilder.order('updated_at', { ascending: false });
      
      // Limit results
      searchQueryBuilder = searchQueryBuilder.limit(150);

      const { data, error: searchError, count } = await searchQueryBuilder;

      if (searchError) {
        console.error('Search error:', searchError);
        throw searchError;
      }

      console.log('Search results:', data?.length || 0);

      let searchResults = (data || []).map(convertFileRecord);
      
      // Client-side smart ranking for better results
      if (searchInfo && searchResults.length > 0) {
        searchResults = searchResults.sort((a, b) => {
          const aScore = calculateRelevanceScore(a, searchInfo);
          const bScore = calculateRelevanceScore(b, searchInfo);
          return bScore - aScore; // Higher score first
        });
      }
      
      setFiles(searchResults);
      setTotalResults(count || searchResults.length);

    } catch (err) {
      console.error('Global search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setFiles([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  // Calculate relevance score for smart ranking
  const calculateRelevanceScore = (file: FileItem, searchInfo: any): number => {
    let score = 0;
    const { originalQuery, words } = searchInfo;
    
    const fileName = file.name.toLowerCase();
    const originalName = file.originalName.toLowerCase();
    const tags = (file.tags || []).map(tag => tag.toLowerCase());
    
    // Exact match in file name (highest score)
    if (fileName.includes(originalQuery)) {
      score += 100;
      // Bonus for exact match at start
      if (fileName.startsWith(originalQuery)) {
        score += 50;
      }
    }
    
    // Exact match in original name
    if (originalName.includes(originalQuery)) {
      score += 80;
      if (originalName.startsWith(originalQuery)) {
        score += 40;
      }
    }
    
    // Word matches
    words.forEach(word => {
      if (fileName.includes(word)) score += 30;
      if (originalName.includes(word)) score += 25;
      
      // Tag matches
      tags.forEach(tag => {
        if (tag.includes(word)) score += 20;
        if (tag === word) score += 40; // Exact tag match
      });
    });
    
    // Bonus for recent files
    const fileDate = new Date(file.modifiedDate);
    const daysSinceModified = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 7) score += 10; // Recent files get bonus
    
    // Bonus for favorites
    if (file.isFavorite) score += 15;
    
    return score;
  };

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchFiles(query, selectedTags, activeView);
    }, 200); // Reduced debounce for faster response

    return () => clearTimeout(timeoutId);
  }, [query, selectedTags, activeView, searchFiles]);

  // Memoize the result to prevent unnecessary re-renders
  const result = useMemo(() => ({
    files,
    loading,
    error,
    totalResults
  }), [files, loading, error, totalResults]);

  return result;
};