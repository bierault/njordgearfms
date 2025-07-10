import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Square, FileText, Image, Video, Music, Archive, File, MoreVertical, Download, Eye, Info, Star, Share2, Edit3, Tag, Move } from 'lucide-react';
import FileCard, { FileItem } from './FileCard';
import FilterBar, { ViewMode, SortOption, SortDirection, FilterType } from './FilterBar';
import BatchActionBar from './BatchActionBar';
import FileMenuDropdown from './FileMenuDropdown';
import FilePreviewModal from './FilePreviewModal';
import { markFilesAsUpdated } from '../contexts/WorkspaceContext';

interface FileGridProps {
  files: FileItem[];
  onFileClick?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
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
  // Server-side sorting
  onServerSortChange?: (sortBy: SortOption, sortDirection: SortDirection) => void;
  // Delete function
  onFileDelete?: (fileId: string) => Promise<void>;
  // User role props
  userRole?: 'admin' | 'employee';
  userProjectAccess?: string[];
  // Active view for context
  activeView?: string;
  className?: string;
}

const FileGrid: React.FC<FileGridProps> = ({ 
  files, 
  onFileClick, 
  onFileDoubleClick,
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
  viewMode = 'grid',
  onViewModeChange,
  sortBy = 'date',
  onSortByChange,
  sortDirection = 'desc',
  onSortDirectionChange,
  filterType = 'all',
  onFilterTypeChange,
  showFilters = true,
  onServerSortChange,
  onFileDelete,
  userRole = 'admin',
  userProjectAccess = [],
  activeView = 'dashboard',
  className = '' 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<FileItem | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<FileItem | null>(null);

  // Apply client-side filters for view-specific filtering (favorites, recent, etc.)
  const filteredFiles = React.useMemo(() => {
    let result = [...files];

    // Apply type filter - this works like the search feature
    switch (filterType) {
      case 'favorites':
        result = files.filter(file => file.isFavorite);
        break;
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        result = files.filter(file => {
          const fileDate = new Date(file.modifiedDate);
          return fileDate > sevenDaysAgo;
        });
        break;
      case 'documents':
        result = files.filter(file => file.type === 'document');
        break;
      case 'images':
        result = files.filter(file => file.type === 'image');
        break;
      case 'videos':
        result = files.filter(file => file.type === 'video');
        break;
      case 'audio':
        result = files.filter(file => file.type === 'audio');
        break;
      case 'archives':
        result = files.filter(file => file.type === 'archive');
        break;
      case 'all':
      default:
        // No additional filtering - server already sorted
        break;
    }

    return result;
  }, [files, filterType]);

  const handleSelectionChange = useCallback((fileId: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSelection = new Set(prev);
      if (selected) {
        newSelection.add(fileId);
      } else {
        newSelection.delete(fileId);
      }
      return newSelection;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.size === filteredFiles.length && filteredFiles.length > 0) {
      // Deselect all
      setSelectedFiles(new Set());
    } else {
      // Select all visible files
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  }, [filteredFiles, selectedFiles.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedFiles(new Set());
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

  const handleBatchMove = useCallback(async (fileIds: string[], projectId: string | null, folderId: string | null) => {
    if (!onFileMove) return;

    console.log('Batch moving files:', fileIds, 'to project:', projectId, 'folder:', folderId);

    // Move files one by one for proper error handling
    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        await onFileMove(fileId, projectId, folderId);
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
  }, [onFileMove]);

  const handleBatchDelete = useCallback(async (fileIds: string[]) => {
    if (!onFileDelete || userRole !== 'admin') return;

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
  }, [onFileDelete, userRole]);

  const handleBatchAddTags = useCallback(async (fileIds: string[], tagsToAdd: string[]) => {
    if (!onFileUpdate || userRole !== 'admin') return;

    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        const file = filteredFiles.find(f => f.id === fileId);
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
  }, [filteredFiles, onFileUpdate, userRole]);

  const handleBatchRemoveTags = useCallback(async (fileIds: string[], tagsToRemove: string[]) => {
    if (!onFileUpdate || userRole !== 'admin') return;

    const errors: string[] = [];
    for (const fileId of fileIds) {
      try {
        const file = filteredFiles.find(f => f.id === fileId);
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
  }, [filteredFiles, onFileUpdate, userRole]);

  // Handle file deletion
  const handleFileDelete = useCallback(async (fileId: string) => {
    console.log('FileGrid: handleFileDelete called for:', fileId);
    if (onFileDelete) {
      try {
        await onFileDelete(fileId);
        console.log('FileGrid: File deleted successfully');
      } catch (error) {
        console.error('FileGrid: Delete failed:', error);
        throw error;
      }
    } else {
      console.error('FileGrid: onFileDelete not provided');
    }
  }, [onFileDelete]);

  // Get file type icon with color
  const getFileTypeIcon = (type: FileItem['type']) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'document':
        return <FileText className={`${iconClass} text-blue-400`} />;
      case 'image':
        return <Image className={`${iconClass} text-green-400`} />;
      case 'video':
        return <Video className={`${iconClass} text-purple-400`} />;
      case 'audio':
        return <Music className={`${iconClass} text-orange-400`} />;
      case 'archive':
        return <Archive className={`${iconClass} text-yellow-400`} />;
      default:
        return <File className={`${iconClass} text-slate-400`} />;
    }
  };

  // Get tag color based on tag name
  const getTagColor = (tag: string, index: number) => {
    const colors = [
      'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'bg-green-500/20 text-green-300 border-green-500/30',
      'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'bg-red-500/20 text-red-300 border-red-500/30',
      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      'bg-pink-500/20 text-pink-300 border-pink-500/30',
      'bg-orange-500/20 text-orange-300 border-orange-500/30'
    ];
    
    // Use tag name to generate consistent color
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Handle row menu actions
  const handleRowMenuClick = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    setActiveRowMenu(activeRowMenu === fileId ? null : fileId);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.storage
        .from('files')
        .download(file.filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
    setActiveRowMenu(null);
  };

  const handleShare = async (file: FileItem) => {
    try {
      const shareUrl = `${window.location.origin}/share/${file.id}`;
      await navigator.clipboard.writeText(shareUrl);
      // You could show a toast notification here
    } catch (error) {
      console.error('Share error:', error);
    }
    setActiveRowMenu(null);
  };

  const handleShowPreview = (file: FileItem) => {
    setShowPreviewModal(file);
    setActiveRowMenu(null);
  };

  const handleShowDetails = (file: FileItem) => {
    setShowDetailsModal(file);
    setActiveRowMenu(null);
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7; // Increased for better navigation
    
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
                  <th className="px-4 py-3 text-left w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors duration-200"
                    >
                      {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-12">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Type</span>
                  </th>
                  <th className="px-4 py-3 text-left w-48">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">File</span>
                  </th>
                  <th className="px-4 py-3 text-left flex-1">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Tags</span>
                  </th>
                  <th className="px-4 py-3 text-left w-20">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Size</span>
                  </th>
                  <th className="px-4 py-3 text-left w-24">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Modified</span>
                  </th>
                  <th className="px-4 py-3 text-left w-32">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredFiles.map((file) => {
                  // Check if employee has access to this file's project
                  const hasAccess = userRole === 'admin' || 
                    !file.projectId || 
                    userProjectAccess.includes(file.projectId);
                  
                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-700 transition-colors duration-200 ${
                        !hasAccess 
                          ? 'opacity-50 cursor-not-allowed' 
                          : selectedFiles.has(file.id) 
                          ? 'bg-blue-600/10' 
                          : 'cursor-pointer'
                      }`}
                      onClick={hasAccess ? (e) => {
                        if (e.ctrlKey || e.metaKey) {
                          handleSelectionChange(file.id, !selectedFiles.has(file.id));
                        } else {
                          onFileClick?.(file);
                        }
                      }
                      : undefined}
                      onDoubleClick={hasAccess ? () => handleShowPreview(file) : undefined}
                      draggable={hasAccess && selectedFiles.has(file.id)}
                      onDragStart={hasAccess && selectedFiles.has(file.id) ? handleDragStart : undefined}
                      onDragEnd={hasAccess && selectedFiles.has(file.id) ? handleDragEnd : undefined}
                    >
                      {/* Selection Checkbox */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasAccess) {
                              handleSelectionChange(file.id, !selectedFiles.has(file.id));
                            }
                          }}
                          disabled={!hasAccess}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                            !hasAccess
                              ? 'border-slate-600 opacity-50 cursor-not-allowed'
                              : selectedFiles.has(file.id)
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-400 hover:border-blue-400'
                          }`}
                        >
                          {selectedFiles.has(file.id) && <CheckSquare className="w-3 h-3" />}
                        </button>
                      </td>

                      {/* File Type Icon */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {getFileTypeIcon(file.type)}
                        </div>
                      </td>

                      {/* Thumbnail + Name (Fixed Width) */}
                      <td className="px-4 py-3 whitespace-nowrap w-48">
                        <div className="flex items-center space-x-3">
                          {/* Small Thumbnail */}
                          <div className="w-10 h-10 rounded bg-slate-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {file.thumbnail ? (
                              <img
                                src={file.thumbnail}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getFileTypeIcon(file.type)
                            )}
                          </div>
                          
                          {/* File Name + Favorite */}
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            {file.isFavorite && (
                              <span className="text-yellow-400 text-xs flex-shrink-0">★</span>
                            )}
                            <span className="text-white font-medium text-sm truncate">
                              {file.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tags (Two Rows, Maximum Visibility) */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-full">
                          {file.tags?.map((tag, index) => (
                            <span
                              key={index}
                              className={`inline-flex items-center px-2 py-0.5 text-xs rounded-md border font-medium ${getTagColor(tag, index)} mb-1 mr-1`}
                            >
                              {tag}
                            </span>
                          ))}
                          
                          {/* No Tags */}
                          {(!file.tags || file.tags.length === 0) && (
                            <span className="text-xs text-slate-500 italic">No tags</span>
                          )}
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300 text-xs">
                        {file.size}
                      </td>

                      {/* Modified Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300 text-xs">
                        {file.modifiedDate}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {/* Preview Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowPreview(file);
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Favorite Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleFavorite) {
                                onToggleFavorite(file.id);
                              }
                            }}
                            className={`p-1.5 rounded transition-colors duration-200 ${
                              file.isFavorite 
                                ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10' 
                                : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-600'
                            }`}
                            title={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-4 h-4 ${file.isFavorite ? 'fill-current' : ''}`} />
                          </button>

                          {/* Download Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Grid view with drag and drop support
    return (
      <div 
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 ${
          isDragging ? 'opacity-75' : ''
        }`}
        draggable={selectedFiles.size > 0}
        onDragStart={selectedFiles.size > 0 ? handleDragStart : undefined}
        onDragEnd={selectedFiles.size > 0 ? handleDragEnd : undefined}
      >
        {filteredFiles.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onClick={onFileClick}
            onDoubleClick={onFileDoubleClick}
            onDelete={handleFileDelete}
            onToggleFavorite={onToggleFavorite}
            onUpdate={onFileUpdate}
            onMove={onFileMove}
            isSelected={selectedFiles.has(file.id)}
            onSelectionChange={handleSelectionChange}
            selectionMode={selectedFiles.size > 0}
            userRole={userRole}
            userProjectAccess={userProjectAccess}
            className={selectedFiles.has(file.id) && isDragging ? 'opacity-50' : ''}
          />
        ))}
      </div>
    );
  };

  const selectedFilesList = Array.from(selectedFiles).map(id => filteredFiles.find(f => f.id === id)).filter(Boolean) as FileItem[];

  // Close row menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveRowMenu(null);
    };

    if (activeRowMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeRowMenu]);

  const getViewDisplayName = (view: string) => {
    switch (view) {
      case 'favorites':
        return 'Favorites';
      case 'recent':
        return 'Recent Files';
      case 'all-files':
        return 'All Files';
      case 'dashboard':
        return 'Dashboard';
      default:
        return 'Current View';
    }
  };

  return (
    <div className={className}>
      {/* Filter Bar - Fixed at top of content area */}
      {showFilters && onViewModeChange && onSortByChange && onSortDirectionChange && onFilterTypeChange && (
        <div className="sticky top-0 z-10 bg-slate-800">
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
            filteredCount={filteredFiles.length}
            onServerSortChange={onServerSortChange}
          />
        </div>
      )}

      <div className="p-6">
        {/* Selection Controls - Only show when files are selected */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-400 font-medium">
                {selectedFiles.size} selected
              </span>
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? (
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
            
            <p className="text-slate-400 text-sm">
              Single-click to select, double-click to preview files. Drag selected files to folders.
            </p>
          </div>
        )}

        {/* Files Display */}
        <div className="mb-8">
          {renderFilesList()}
        </div>

        {/* Pagination Controls - Enhanced for better navigation */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            {/* Page Info */}
            <div className="text-sm text-slate-400">
              Showing {((currentPage - 1) * 50) + 1} to {Math.min(currentPage * 50, totalCount)} of {totalCount} files
              {activeView && activeView !== 'dashboard' && ` in ${getViewDisplayName(activeView)}`}
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-2">
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
          </div>
        )}

        {/* Empty state */}
        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-slate-400 text-2xl">📁</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No files found</h3>
            <p className="text-slate-400 mb-6">
              {filterType !== 'all' 
                ? `No files match the current filter: ${filterType}`
                : activeView && activeView !== 'dashboard'
                ? `No files found in ${getViewDisplayName(activeView)}`
                : 'Start by uploading your first file or creating a folder.'
              }
            </p>
            {filterType !== 'all' && onFilterTypeChange && (
              <button 
                onClick={() => onFilterTypeChange('all')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 mr-4"
              >
                Show All Files
              </button>
            )}
            {(activeView === 'dashboard' || activeView === 'all-files') && (
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200">
                Upload Files
              </button>
            )}
          </div>
        )}
      </div>

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedFiles={selectedFilesList}
        onClearSelection={handleClearSelection}
        onBatchMove={handleBatchMove}
        onBatchAddTags={handleBatchAddTags}
        onBatchRemoveTags={handleBatchRemoveTags}
        onBatchToggleFavorite={handleBatchToggleFavorite}
        onBatchDelete={handleBatchDelete}
        userRole={userRole}
        userProjectAccess={userProjectAccess}
      />

      {/* File Details Modal */}
      <FilePreviewModal
        file={showDetailsModal}
        isOpen={!!showDetailsModal}
        onClose={() => setShowDetailsModal(null)}
        onUpdate={onFileUpdate}
        onToggleFavorite={onToggleFavorite}
        userRole={userRole}
      />

      {/* File Preview Modal */}
      {showPreviewModal && (
        <FilePreviewModal
          file={showPreviewModal}
          isOpen={!!showPreviewModal}
          onClose={() => setShowPreviewModal(null)}
          onUpdate={onFileUpdate}
          onToggleFavorite={onToggleFavorite}
          userRole={userRole}
          isPreviewMode={true}
        />
      )}
    </div>
  );
};

export default FileGrid;