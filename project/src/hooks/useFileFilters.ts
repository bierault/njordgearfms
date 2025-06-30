import { useMemo } from 'react';
import { FileItem } from '../components/FileCard';
import { ViewMode, SortOption, SortDirection, FilterType } from '../components/FilterBar';

interface UseFileFiltersProps {
  files: FileItem[];
  viewMode: ViewMode;
  sortBy: SortOption;
  sortDirection: SortDirection;
  filterType: FilterType;
  searchQuery?: string;
  selectedTags?: string[];
  activeView?: string;
}

export const useFileFilters = ({
  files,
  viewMode,
  sortBy,
  sortDirection,
  filterType,
  searchQuery = '',
  selectedTags = [],
  activeView = 'dashboard'
}: UseFileFiltersProps) => {
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(file => {
        const nameMatch = file.name.toLowerCase().includes(query) || 
                         file.originalName.toLowerCase().includes(query);
        
        const tagMatch = file.tags?.some(tag => 
          tag.toLowerCase().includes(query)
        ) || false;
        
        return nameMatch || tagMatch;
      });
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      result = result.filter(file => {
        if (!file.tags || file.tags.length === 0) {
          return false;
        }
        return selectedTags.some(filterTag => 
          file.tags!.some(fileTag => 
            fileTag.toLowerCase() === filterTag.toLowerCase()
          )
        );
      });
    }

    // Apply type filter - SIMPLE filtering like search
    switch (filterType) {
      case 'favorites':
        // Show ONLY files that are favorited
        result = result.filter(file => file.isFavorite === true);
        break;
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        result = result.filter(file => {
          const fileDate = new Date(file.modifiedDate);
          return fileDate > sevenDaysAgo;
        });
        break;
      case 'documents':
        result = result.filter(file => file.type === 'document');
        break;
      case 'images':
        result = result.filter(file => file.type === 'image');
        break;
      case 'videos':
        result = result.filter(file => file.type === 'video');
        break;
      case 'audio':
        result = result.filter(file => file.type === 'audio');
        break;
      case 'archives':
        result = result.filter(file => file.type === 'archive');
        break;
      case 'all':
      default:
        // No additional filtering - server-side view filtering already applied
        break;
    }

    // Note: Sorting is now handled server-side, so we don't sort here
    return result;
  }, [files, viewMode, sortBy, sortDirection, filterType, searchQuery, selectedTags, activeView]);

  return {
    filteredFiles: filteredAndSortedFiles,
    totalCount: files.length,
    filteredCount: filteredAndSortedFiles.length
  };
};