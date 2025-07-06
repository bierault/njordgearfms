import { useMemo } from 'react';
import { FileItem } from '../components/FileCard';

export interface SearchFilters {
  query: string;
  tags: string[];
  type?: FileItem['type'];
  isFavorite?: boolean;
}

export const useFileSearch = (files: FileItem[], filters: SearchFilters) => {
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Filter by search query (name and tags)
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase().trim();
      result = result.filter(file => {
        // Search in file names (both display name and original name)
        const nameMatch = file.name.toLowerCase().includes(query) || 
                         file.originalName.toLowerCase().includes(query);
        
        // Search in actual tags only (no placeholder tags)
        const actualTagMatch = file.tags?.some(tag => 
          tag.toLowerCase().includes(query)
        ) || false;
        
        return nameMatch || actualTagMatch;
      });
    }

    // Filter by selected tags
    if (filters.tags.length > 0) {
      result = result.filter(file => {
        // Only check actual tags, no placeholder tags
        if (!file.tags || file.tags.length === 0) {
          return false;
        }
        
        return filters.tags.some(filterTag => 
          file.tags!.some(fileTag => 
            fileTag.toLowerCase() === filterTag.toLowerCase()
          )
        );
      });
    }

    // Filter by file type
    if (filters.type) {
      result = result.filter(file => file.type === filters.type);
    }

    // Filter by favorite status
    if (filters.isFavorite !== undefined) {
      result = result.filter(file => file.isFavorite === filters.isFavorite);
    }

    return result;
  }, [files, filters]);

  return filteredFiles;
};

// Helper function to get all unique tags from files (only actual tags, no placeholders)
export const getAllTags = (files: FileItem[]): string[] => {
  const tagSet = new Set<string>();
  
  files.forEach(file => {
    if (file.tags && file.tags.length > 0) {
      file.tags.forEach(tag => tagSet.add(tag));
    }
  });
  
  return Array.from(tagSet).sort();
};