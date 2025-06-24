import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
import FileCard, { FileItem } from './FileCard';
import FilterBar, { ViewMode, SortOption, SortDirection, FilterType } from './FilterBar';
import BatchActionBar from './BatchActionBar';
import { markFilesAsUpdated } from '../contexts/WorkspaceContext';

interface FileGridProps {
  files: FileItem[];
  onFileClick?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  onFileDelete?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string) => void;
  onFileUpdate?: (fileId: string, updates: Partial<FileItem>) => void;
  onFileMove?: (fileId: string, projectId: string | null, folderId: string | null) => void;
  onFilesDragStart?: (fileIds: string[]) => void;
  onFilesDragEnd?: () => void;
  // Pagination props
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGoToPage: (page: number) => void;
  // View props
  viewTitle?: string;
  viewDescription?: string;
  // Filter props
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  sortBy?: SortOption;
  onSortByChange?: (sort: SortOption) => void;
  sortDirection?: SortDirection;
  onSortDirectionChange?: (direction: SortDirection) => void;
  filterType?: FilterType;
  onFilterTypeChange?: (filter: FilterType) => void;
  showFilters?: boolean;
  className?: string;
}

const FileGrid: React.FC<FileGridProps> = ({ 
  files, 
  onFileClick, 
  onFileDoubleClick,
  onFileDelete,
  onToggleFavorite,
  onFileUpdate,
  onFileMove,
  onFilesDragStart,
  onFilesDragEnd,
  currentPage,
  totalPages,
  totalCount,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onGoToPage,
  viewTitle = 'Dashboard',
  viewDescription = 'Manage your files and folders with ease.',
  viewMode = 'grid',
  onViewModeChange,
  sortBy = 'date',
  onSortByChange,
  sortDirection = 'desc',
  onSortDirectionChange,
  filterType = 'all',
  onFilterTypeChange,
  showFilters = true,
  className = '' 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectionChange = useCallback((fileId: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSelection = new Set(prev);
      if (selected) {
        newSelection.add(fileId);
        // Auto-enable selection mode when first file is selected
        if (!selectionMode) {
          setSelectionMode(true);
        }
      } else {
        newSelection.delete(fileId);
        // Auto-disable selection mode when no files are selected
        if (newSelection.size === 0) {
          setSelectionMode(false);
        }
      }
      
      return newSelection;
    });
  }, [selectionMode]);

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length && files.length > 0) {
      // Deselect all
      setSelectedFiles(new Set());
      setSelectionMode(false);
    } else {
      // Select all
      setSelectedFiles(new Set(files.map(f => f.id)));
      setSelectionMode(true);
    }
  }, [files, selectedFiles.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectionMode(false);
  }, []);

  // Handle drag start for selected files
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (selectedFiles.size === 0) return;
    
    const fileIds = Array.from(selectedFiles);
    console.log('Starting drag for files:', fileIds);
    
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `files:${JSON.stringify(fileIds)}`);
    
    // Call the drag start handler if provided
    onFilesDragStart?.(fileIds);
  }, [selectedFiles, onFilesDragStart]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    console.log('Drag ended');
    setIsDragging(false);
    onFilesDragEnd?.();
  }, [onFilesDragEnd]);

  const handleBatchToggleFavorite = useCallback(async (fileIds: string[]) => {
    if (!onToggleFavorite) return;

    // Toggle favorite for each file
    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        await onToggleFavorite(fileId);
      } catch (error) {
        errors.push(fileId);
        console.error(`Failed to toggle favorite for file ${fileId}:`, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to update favorites for ${errors.length} file(s)`);
    }

    // Mark files as updated for smart refresh
    markFilesAsUpdated();
  }, [onToggleFavorite]);

  const handleBatchDelete = useCallback(async (fileIds: string[]) => {
    if (!onFileDelete) return;

    // Delete files one by one for proper error handling
    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        await onFileDelete(fileId);
      } catch (error) {
        errors.push(fileId);
        console.error(`Failed to delete file ${fileId}:`, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to delete ${errors.length} file(s)`);
    }

    // Mark files as updated for smart refresh
    markFilesAsUpdated();
  }, [onFileDelete]);

  const handleBatchMove = useCallback(async (fileIds: string[], projectId: string | null, folderId: string | null) => {
    if (!onFileUpdate) return;

    // Move files one by one for proper error handling
    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        await onFileUpdate(fileId, { 
          projectId: projectId || undefined, 
          folderId: folderId || undefined 
        });
      } catch (error) {
        errors.push(fileId);
        console.error(`Failed to move file ${fileId}:`, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to move ${errors.length} file(s)`);
    }

    // Mark files as updated for smart refresh
    markFilesAsUpdated();
  }, [onFileUpdate]);

  const handleBatchAddTags = useCallback(async (fileIds: string[], tagsToAdd: string[]) => {
    if (!onFileUpdate) return;

    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        const file = files.find(f => f.id === fileId);
        if (file) {
          const currentTags = file.tags || [];
          const newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Merge and deduplicate
          await onFileUpdate(fileId, { tags: newTags });
        }
      } catch (error) {
        errors.push(fileId);
        console.error(`Failed to add tags to file ${fileId}:`, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to add tags to ${errors.length} file(s)`);
    }

    // Mark files as updated for smart refresh
    markFilesAsUpdated();
  }, [files, onFileUpdate]);

  const handleBatchRemoveTags = useCallback(async (fileIds: string[], tagsToRemove: string[]) => {
    if (!onFileUpdate) return;

    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        const file = files.find(f => f.id === fileId);
        if (file) {
          const currentTags = file.tags || [];
          const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
          await onFileUpdate(fileId, { tags: newTags });
        }
      } catch (error) {
        errors.push(fileId);
        console.error(`Failed to remove tags from file ${fileId}:`, error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to remove tags from ${errors.length} file(s)`);
    }

    // Mark files as updated for smart refresh
    markFilesAsUpdated();
  }, [files, onFileUpdate]);

  const getFileTypeCount = (type: FileItem['type']) => {
    return files.filter(file => file.type === type).length;
  };

  const getTotalSize = () => {
    const totalBytes = files.reduce((sum, file) => sum + file.fileSize, 0);
    if (totalBytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(totalBytes) / Math.log(k));
    return parseFloat((totalBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFavoriteCount = () => {
    return files.filter(file => file.isFavorite).length;
  };

  const getRecentCount = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return files.filter(file => new Date(file.modifiedDate) > sevenDaysAgo).length;
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => onGoToPage(1)}
          className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors duration-200"
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="px-2 text-slate-500">...</span>
        );
      }
    }

    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onGoToPage(i)}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
            i === currentPage
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          {i}
        </button>
      );
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="px-2 text-slate-500">...</span>
        );
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => onGoToPage(totalPages)}
          className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors duration-200"
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  const renderFilesList = () => {
    if (viewMode === 'list') {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors duration-200"
                    >
                      {selectedFiles.size === files.length && files.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span className="text-xs font-medium uppercase tracking-wider">Select</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Modified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-700 cursor-pointer transition-colors duration-200 ${
                      selectedFiles.has(file.id) ? 'bg-blue-600/10' : ''
                    }`}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || selectionMode) {
                        handleSelectionChange(file.id, !selectedFiles.has(file.id));
                      } else {
                        onFileClick?.(file);
                      }
                    }}
                    onDoubleClick={() => !selectionMode && onFileDoubleClick?.(file)}
                    draggable={selectedFiles.has(file.id)}
                    onDragStart={selectedFiles.has(file.id) ? handleDragStart : undefined}
                    onDragEnd={selectedFiles.has(file.id) ? handleDragEnd : undefined}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectionChange(file.id, !selectedFiles.has(file.id));
                        }}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                          selectedFiles.has(file.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-400 hover:border-blue-400'
                        }`}
                      >
                        {selectedFiles.has(file.id) && <CheckSquare className="w-3 h-3" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {file.isFavorite && (
                          <span className="text-yellow-400">★</span>
                        )}
                        <span className="text-white font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                        {file.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {file.size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {file.modifiedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {file.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-600 text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                        {file.tags && file.tags.length > 2 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-600 text-slate-300">
                            +{file.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Grid view with drag and drop support
    return (
      <div 
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4 ${
          isDragging ? 'opacity-75' : ''
        }`}
        draggable={selectedFiles.size > 0}
        onDragStart={selectedFiles.size > 0 ? handleDragStart : undefined}
        onDragEnd={selectedFiles.size > 0 ? handleDragEnd : undefined}
      >
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onClick={onFileClick}
            onDoubleClick={onFileDoubleClick}
            onDelete={onFileDelete}
            onToggleFavorite={onToggleFavorite}
            onUpdate={onFileUpdate}
            onMove={onFileMove}
            isSelected={selectedFiles.has(file.id)}
            onSelectionChange={handleSelectionChange}
            selectionMode={selectionMode}
            className={selectedFiles.has(file.id) && isDragging ? 'opacity-50' : ''}
          />
        ))}
      </div>
    );
  };

  const selectedFilesList = Array.from(selectedFiles).map(id => files.find(f => f.id === id)).filter(Boolean) as FileItem[];

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{viewTitle}</h1>
            <p className="text-slate-400">
              {viewDescription}
              {files.length > 0 && <span className="text-slate-500 ml-2">Click to select, double-click to preview files. Drag selected files to folders.</span>}
            </p>
          </div>
          
          {/* Selection Controls */}
          {files.length > 0 && (
            <div className="flex items-center space-x-3">
              {selectedFiles.size > 0 && (
                <span className="text-sm text-blue-400 font-medium">
                  {selectedFiles.size} selected
                </span>
              )}
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {selectedFiles.size === files.length && files.length > 0 ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>Select All</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && onViewModeChange && onSortByChange && onSortDirectionChange && onFilterTypeChange && (
        <FilterBar
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          sortDirection={sortDirection}
          onSortDirectionChange={onSortDirectionChange}
          filterType={filterType}
          onFilterTypeChange={onFilterTypeChange}
          totalCount={totalCount}
          filteredCount={files.length}
          className="mb-6"
        />
      )}

      {/* Stats Cards - Only show on dashboard */}
      {viewTitle === 'Dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Files</p>
                <p className="text-2xl font-bold text-white">{totalCount}</p>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">{totalCount}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Storage Used</p>
                <p className="text-2xl font-bold text-white">{getTotalSize()}</p>
              </div>
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">↗</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Favorites</p>
                <p className="text-2xl font-bold text-white">{getFavoriteCount()}</p>
              </div>
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">⭐</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Recent Activity</p>
                <p className="text-2xl font-bold text-white">{getRecentCount()}</p>
              </div>
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">⚡</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Info */}
      {totalCount > 0 && viewTitle === 'Dashboard' && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-slate-400">
            Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} files
          </div>
          <div className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}

      {/* Files Display */}
      <div className="mb-8">
        {renderFilesList()}
      </div>

      {/* Pagination Controls - Only show on dashboard with multiple pages */}
      {totalPages > 1 && viewTitle === 'Dashboard' && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={onPrevPage}
            disabled={!hasPrevPage}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 disabled:text-slate-500 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-1">
            {renderPageNumbers()}
          </div>

          <button
            onClick={onNextPage}
            disabled={!hasNextPage}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 disabled:text-slate-500 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-400 text-2xl">📁</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {viewTitle === 'Favorites' ? 'No favorite files' :
             viewTitle === 'Recent' ? 'No recent files' :
             viewTitle === 'Trash' ? 'Trash is empty' :
             'No files yet'}
          </h3>
          <p className="text-slate-400 mb-6">
            {viewTitle === 'Favorites' ? 'Star some files to see them here.' :
             viewTitle === 'Recent' ? 'Files modified in the last 7 days will appear here.' :
             viewTitle === 'Trash' ? 'Deleted files will appear here (feature coming soon).' :
             'Start by uploading your first file or creating a folder.'}
          </p>
          {(viewTitle === 'Dashboard' || viewTitle === 'All Files') && (
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200">
              Upload Files
            </button>
          )}
        </div>
      )}

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedFiles={selectedFilesList}
        onClearSelection={handleClearSelection}
        onBatchDelete={handleBatchDelete}
        onBatchMove={handleBatchMove}
        onBatchAddTags={handleBatchAddTags}
        onBatchRemoveTags={handleBatchRemoveTags}
        onBatchToggleFavorite={handleBatchToggleFavorite}
      />
    </div>
  );
};

export default FileGrid;