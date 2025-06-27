import React from 'react';
import { Grid3X3, List, SortAsc, SortDesc, ChevronDown } from 'lucide-react';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'name' | 'date' | 'size' | 'type';
export type SortDirection = 'asc' | 'desc';
export type FilterType = 'all' | 'favorites' | 'recent' | 'documents' | 'images' | 'videos' | 'audio' | 'archives';

interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
  filterType: FilterType;
  onFilterTypeChange: (filter: FilterType) => void;
  totalCount: number;
  filteredCount: number;
  // New prop for server-side sorting
  onServerSortChange?: (sortBy: SortOption, sortDirection: SortDirection) => void;
  className?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  filterType,
  onFilterTypeChange,
  totalCount,
  filteredCount,
  onServerSortChange,
  className = ''
}) => {
  const getSortLabel = () => {
    switch (sortBy) {
      case 'name': return 'Name';
      case 'date': return 'Date Modified';
      case 'size': return 'File Size';
      case 'type': return 'File Type';
      default: return 'Recommended';
    }
  };

  const getFilterLabel = () => {
    switch (filterType) {
      case 'all': return 'All Files';
      case 'favorites': return 'Favorites';
      case 'recent': return 'Recent';
      case 'documents': return 'Documents';
      case 'images': return 'Images';
      case 'videos': return 'Videos';
      case 'audio': return 'Audio';
      case 'archives': return 'Archives';
      default: return 'All Files';
    }
  };

  const handleSortChange = (newSortBy: SortOption) => {
    if (onServerSortChange) {
      // Use server-side sorting
      const newDirection = newSortBy === sortBy && sortDirection === 'asc' ? 'desc' : 'asc';
      onServerSortChange(newSortBy, newDirection);
    } else {
      // Use client-side sorting (fallback)
      onSortByChange(newSortBy);
    }
  };

  const handleDirectionChange = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    if (onServerSortChange) {
      // Use server-side sorting
      onServerSortChange(sortBy, newDirection);
    } else {
      // Use client-side sorting (fallback)
      onSortDirectionChange(newDirection);
    }
  };

  return (
    <div className={`bg-slate-800 border-b border-slate-700 px-6 py-2 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Left Section - View Mode */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md transition-colors duration-200 ${
                viewMode === 'grid'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
              }`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-md transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-slate-400">
            {filteredCount !== totalCount ? (
              <span>{filteredCount} of {totalCount} files</span>
            ) : (
              <span>{totalCount} files</span>
            )}
          </div>
        </div>

        {/* Right Section - Sort and Filter */}
        <div className="flex items-center space-x-3">
          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value as FilterType)}
              className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-600 transition-colors duration-200 pr-8"
            >
              <option value="all" className="bg-slate-700 text-white">All Files</option>
              <option value="favorites" className="bg-slate-700 text-white">Favorites</option>
              <option value="recent" className="bg-slate-700 text-white">Recent</option>
              <option value="documents" className="bg-slate-700 text-white">Documents</option>
              <option value="images" className="bg-slate-700 text-white">Images</option>
              <option value="videos" className="bg-slate-700 text-white">Videos</option>
              <option value="audio" className="bg-slate-700 text-white">Audio</option>
              <option value="archives" className="bg-slate-700 text-white">Archives</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400">Sort:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-600 transition-colors duration-200 pr-8"
              >
                <option value="date" className="bg-slate-700 text-white">Date Modified</option>
                <option value="name" className="bg-slate-700 text-white">Name</option>
                <option value="size" className="bg-slate-700 text-white">File Size</option>
                <option value="type" className="bg-slate-700 text-white">File Type</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={handleDirectionChange}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
              title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortDirection === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;