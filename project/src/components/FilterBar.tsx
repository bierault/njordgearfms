import React from 'react';
import { Grid3X3, List, Filter, SortAsc, SortDesc, Calendar, FileText, Star, Hash } from 'lucide-react';

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
  className = ''
}) => {
  const sortOptions = [
    { value: 'name' as const, label: 'Name', icon: Hash },
    { value: 'date' as const, label: 'Date Modified', icon: Calendar },
    { value: 'size' as const, label: 'File Size', icon: FileText },
    { value: 'type' as const, label: 'File Type', icon: Filter },
  ];

  const filterOptions = [
    { value: 'all' as const, label: 'All Files', count: totalCount },
    { value: 'favorites' as const, label: 'Favorites', icon: Star },
    { value: 'recent' as const, label: 'Recent (7 days)', icon: Calendar },
    { value: 'documents' as const, label: 'Documents' },
    { value: 'images' as const, label: 'Images' },
    { value: 'videos' as const, label: 'Videos' },
    { value: 'audio' as const, label: 'Audio' },
    { value: 'archives' as const, label: 'Archives' },
  ];

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left Section - View Mode and Sort */}
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
              }`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as SortOption)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200"
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

        {/* Right Section - Filter and Count */}
        <div className="flex items-center space-x-4">
          {/* Filter Dropdown */}
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value as FilterType)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Results Count */}
          <div className="text-sm text-slate-400">
            {filteredCount !== totalCount ? (
              <span>
                Showing {filteredCount} of {totalCount} files
              </span>
            ) : (
              <span>{totalCount} files</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;