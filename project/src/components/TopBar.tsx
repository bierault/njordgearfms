import React, { useState } from 'react';
import { Search, Upload, Menu, X, Folder } from 'lucide-react';
import UploadModal from './UploadModal';
import WorkspaceSelector from './WorkspaceSelector';
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
  className = '' 
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);

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

  return (
    <>
      <div className={`bg-slate-800 border-b border-slate-700 px-6 py-4 ${className}`}>
        <div className="flex items-center justify-between">
          {/* Left Section - Mobile Menu + Logo/Workspace Selector */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo with Workspace Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceSelector(!showWorkspaceSelector)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Folder className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">FileVault</span>
              </button>

              {/* Workspace Selector Dropdown */}
              {showWorkspaceSelector && (
                <div className="absolute top-full left-0 mt-2 z-50">
                  <WorkspaceSelector 
                    onClose={() => setShowWorkspaceSelector(false)}
                    isDropdown={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Search + Upload */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search files, folders, or tags..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-80 pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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

            {/* Upload Button */}
            <button 
              onClick={handleUploadClick}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Upload Files</span>
            </button>
          </div>
        </div>

        {/* Selected Tags Bar */}
        {selectedTags.length > 0 && (
          <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-700">
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

      {/* Click outside to close workspace selector */}
      {showWorkspaceSelector && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowWorkspaceSelector(false)}
        />
      )}

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