import React, { useState } from 'react';
import { Search, Upload, Menu, X } from 'lucide-react';
import UploadModal from './UploadModal';
import TagChip from './TagChip';
import { getAllTags } from '../hooks/useFileSearch';
import { FileItem } from './FileCard';

interface TopBarProps {
  onMenuClick?: () => void;
  onUploadComplete?: () => void;
  onSearchChange?: (query: string) => void;
  onTagsChange?: (tags: string[]) => void;
  searchQuery?: string;
  selectedTags?: string[];
  files?: FileItem[];
  currentPageTitle?: string;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ 
  onMenuClick, 
  onUploadComplete,
  onSearchChange,
  onTagsChange,
  searchQuery = '',
  selectedTags = [],
  files = [],
  currentPageTitle = 'Dashboard',
  className = '' 
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleUploadComplete = () => {
    onUploadComplete?.();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value);
  };

  const handleTagRemove = (tag: string) => {
    onTagsChange?.(selectedTags.filter(t => t !== tag));
  };

  const clearAllTags = () => {
    onTagsChange?.([]);
  };

  // Don't show upload and search on Tags page
  const isTagsPage = currentPageTitle === 'Tags';

  return (
    <>
      <div className={`bg-slate-800 border-b border-slate-700 ${className}`}>
        <div className="flex items-center px-6 py-4">
          {/* Left Section - Mobile Menu + Page Title (Fixed Width) */}
          <div className="flex items-center space-x-4 w-72 flex-shrink-0">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Current Page Title */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-white truncate">{currentPageTitle}</h1>
            </div>
          </div>

          {/* Center Section - Search Bar (Only show if not Tags page) */}
          {!isTagsPage && (
            <div className="flex-1 flex justify-center px-12">
              <div className="relative w-full max-w-3xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files, folders, or tags..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange?.('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right Section - Upload Button (Only show if not Tags page) */}
          {!isTagsPage && (
            <div className="flex items-center w-32 justify-end flex-shrink-0">
              <button 
                onClick={handleUploadClick}
                className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-lg shadow-blue-600/25"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>
          )}
        </div>

        {/* Selected Tags Bar */}
        {selectedTags.length > 0 && !isTagsPage && (
          <div className="flex items-center space-x-2 px-6 pb-4">
            <span className="text-sm text-slate-400">Filtered by:</span>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => (
                <TagChip
                  key={tag}
                  tag={tag}
                  variant="removable"
                  onRemove={handleTagRemove}
                />
              ))}
            </div>
            <button
              onClick={clearAllTags}
              className="text-xs text-slate-400 hover:text-white transition-colors duration-200 ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
};

export default TopBar;