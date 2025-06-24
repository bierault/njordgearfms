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
}

export const useFileFilters = ({
  files,
  viewMode,
  sortBy,
  sortDirection,
  filterType,
  searchQuery = '',
  selectedTags = []
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

    // Apply type filter
    switch (filterType) {
      case 'favorites':
        result = result.filter(file => file.isFavorite);
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
        // No additional filtering
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          const dateA = new Date(a.modifiedDate).getTime();
          const dateB = new Date(b.modifiedDate).getTime();
          comparison = dateA - dateB;
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, viewMode, sortBy, sortDirection, filterType, searchQuery, selectedTags]);

  return {
    filteredFiles: filteredAndSortedFiles,
    totalCount: files.length,
    filteredCount: filteredAndSortedFiles.length
  };
};