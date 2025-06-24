import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Folder, FolderOpen, ChevronRight, MoreVertical, Upload, FileText, Search, X, Move, Edit3, Trash2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useFileData } from '../hooks/useFileData';
import { useFileFilters } from '../hooks/useFileFilters';
import { useFileSearch, SearchFilters } from '../hooks/useFileSearch';
import FileGrid from './FileGrid';
import UploadModal from './UploadModal';
import FilePreviewModal from './FilePreviewModal';
import { ViewMode, SortOption, SortDirection, FilterType } from './FilterBar';
import { FileItem } from './FileCard';
import { Folder as FolderType } from '../types/project';
import { markFilesAsUpdated, shouldRefreshFiles, clearFilesUpdateFlag } from '../contexts/WorkspaceContext';

interface ProjectViewProps {
  onBack: () => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ onBack }) => {
  const { 
    currentProject, 
    currentFolder, 
    folderTree, 
    switchFolder, 
    createFolder,
    deleteFolder,
    moveFolder,
    updateFolder,
    getFolderPath,
    loading: projectLoading,
    error: projectError
  } = useProject();
  
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderMenu, setSelectedFolderMenu] = useState<string | null>(null);
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [createFolderParent, setCreateFolderParent] = useState<string | null>(null);
  
  // File drag and drop state
  const [draggedFiles, setDraggedFiles] = useState<string[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Search state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags: []
  });

  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Get files for current project/folder context
  const { 
    files, 
    loading: filesLoading, 
    error: filesError, 
    removeFile, 
    toggleFavorite, 
    updateFile, 
    addFiles, 
    refreshFiles 
  } = useFileData(true); // Enable project context filtering

  // Apply search filters first
  const searchFilteredFiles = useFileSearch(files, searchFilters);

  // Apply additional filters to search results
  const { filteredFiles, totalCount: filteredTotalCount, filteredCount } = useFileFilters({
    files: searchFilteredFiles,
    viewMode,
    sortBy,
    sortDirection,
    filterType,
    searchQuery: '',
    selectedTags: []
  });

  // Smart refresh when returning to project view or switching folders
  useEffect(() => {
    if (shouldRefreshFiles()) {
      console.log('Files have been updated, refreshing project view');
      setTimeout(() => {
        refreshFiles();
        clearFilesUpdateFlag();
      }, 50);
    }
  }, [currentProject, currentFolder, refreshFiles]);

  // Close folder menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedFolderMenu(null);
    };

    if (selectedFolderMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [selectedFolderMenu]);

  // Show loading state while project data is loading
  if (projectLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  // Show error state if project failed to load
  if (projectError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Project Error</h3>
          <p className="text-slate-400 mb-6">{projectError}</p>
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  // Show no project state if no project is selected
  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Folder className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Project Selected</h3>
          <p className="text-slate-400 mb-6">Select a project from the sidebar to get started.</p>
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentProject) return;

    try {
      await createFolder({
        name: newFolderName.trim(),
        project_id: currentProject.id,
        parent_id: createFolderParent
      });
      setNewFolderName('');
      setShowCreateFolder(false);
      setCreateFolderParent(null);
      
      markFilesAsUpdated();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folderTree.find(f => f.id === folderId) || 
                   folderTree.flatMap(f => f.children || []).find(f => f.id === folderId);
    
    if (!folder) return;

    if (window.confirm(`Are you sure you want to delete "${folder.name}"? All files and subfolders will be moved to the project root.`)) {
      try {
        await deleteFolder(folderId);
        setSelectedFolderMenu(null);
        markFilesAsUpdated();
      } catch (error) {
        console.error('Failed to delete folder:', error);
        alert('Failed to delete folder. Please try again.');
      }
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) return;

    try {
      await updateFolder(folderId, { name: newName.trim() });
      setEditingFolder(null);
      setEditFolderName('');
      setSelectedFolderMenu(null);
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert('Failed to rename folder. Please try again.');
    }
  };

  const handleFolderClick = (folderId: string) => {
    console.log('Folder clicked:', folderId);
    setSelectedFolderMenu(null);
    switchFolder(folderId);
    
    // Clear search when navigating to different folder
    setSearchFilters({ query: '', tags: [] });
  };

  const handleProjectRootClick = () => {
    console.log('Project root clicked');
    setSelectedFolderMenu(null);
    switchFolder(null);
    
    // Clear search when navigating to project root
    setSearchFilters({ query: '', tags: [] });
  };

  const handleFolderMenuClick = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setSelectedFolderMenu(selectedFolderMenu === folderId ? null : folderId);
  };

  // Drag and drop handlers for folder nesting
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.stopPropagation();
    setDraggedFolder(folderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `folder:${folderId}`);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragData = e.dataTransfer.getData('text/plain');
    
    // Handle file drag over folder
    if (dragData.startsWith('files:') || isDraggingFiles) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolder(folderId);
      return;
    }
    
    // Handle folder drag over folder
    if (draggedFolder === folderId) return;
    
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragData = e.dataTransfer.getData('text/plain');
    
    // Handle file drop on folder
    if (dragData.startsWith('files:') || isDraggingFiles) {
      const fileIds = dragData.startsWith('files:') 
        ? JSON.parse(dragData.substring(6))
        : draggedFiles;
      
      if (fileIds.length > 0) {
        try {
          console.log('Moving files to folder:', targetFolderId, fileIds);
          
          // Move each file to the target folder
          for (const fileId of fileIds) {
            await updateFile(fileId, {
              projectId: currentProject?.id,
              folderId: targetFolderId || undefined
            });
          }
          
          markFilesAsUpdated();
          setTimeout(() => refreshFiles(), 50);
          
          console.log(`Successfully moved ${fileIds.length} files to ${targetFolderId ? 'folder' : 'project root'}`);
        } catch (error) {
          console.error('Failed to move files:', error);
          alert('Failed to move files. Please try again.');
        }
      }
      
      setDraggedFiles([]);
      setIsDraggingFiles(false);
      setDragOverFolder(null);
      return;
    }
    
    // Handle folder drop on folder
    if (!draggedFolder || draggedFolder === targetFolderId) {
      setDraggedFolder(null);
      setDragOverFolder(null);
      return;
    }

    try {
      await moveFolder(draggedFolder, targetFolderId);
      console.log('Folder moved successfully');
    } catch (error) {
      console.error('Failed to move folder:', error);
      alert('Failed to move folder. Please try again.');
    } finally {
      setDraggedFolder(null);
      setDragOverFolder(null);
    }
  };

  // File drag handlers for the main file grid
  const handleFilesDragStart = (fileIds: string[]) => {
    console.log('Files drag started:', fileIds);
    setDraggedFiles(fileIds);
    setIsDraggingFiles(true);
  };

  const handleFilesDragEnd = () => {
    console.log('Files drag ended');
    setDraggedFiles([]);
    setIsDraggingFiles(false);
    setDragOverFolder(null);
  };

  const handleUploadComplete = (uploadedFiles: any[]) => {
    console.log('Upload completed in project:', uploadedFiles);
    if (uploadedFiles && uploadedFiles.length > 0) {
      addFiles(uploadedFiles);
      markFilesAsUpdated();
    }
    setTimeout(() => {
      refreshFiles();
    }, 50);
  };

  const handleFileMove = async (fileId: string, projectId: string | null, folderId: string | null) => {
    try {
      await updateFile(fileId, { 
        projectId: projectId || undefined, 
        folderId: folderId || undefined 
      });
      
      markFilesAsUpdated();
      
      setTimeout(() => {
        refreshFiles();
      }, 50);
    } catch (error) {
      console.error('Failed to move file:', error);
      throw error;
    }
  };

  const handleFileClick = (file: FileItem) => {
    console.log('File clicked:', file);
  };

  const handleFileDoubleClick = (file: FileItem) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setSelectedFile(null);
  };

  const handleSearchChange = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  const handleTagsChange = (tags: string[]) => {
    setSearchFilters(prev => ({ ...prev, tags }));
  };

  const clearSearch = () => {
    setSearchFilters({ query: '', tags: [] });
  };

  const handleFileUpdate = async (fileId: string, updates: Partial<FileItem>) => {
    try {
      await updateFile(fileId, updates);
      markFilesAsUpdated();
      
      if (selectedFile && selectedFile.id === fileId) {
        setSelectedFile({ ...selectedFile, ...updates });
      }
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await removeFile(fileId);
      markFilesAsUpdated();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      await toggleFavorite(fileId);
      markFilesAsUpdated();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const renderFolderTree = (folders: FolderType[], level: number = 0) => {
    return folders.map(folder => (
      <div key={folder.id} className="select-none relative">
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 group ${
            currentFolder?.id === folder.id
              ? 'bg-blue-600 text-white'
              : dragOverFolder === folder.id
              ? 'bg-blue-500/20 border-2 border-blue-500 border-dashed'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          } ${draggedFolder === folder.id ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => editingFolder !== folder.id && handleFolderClick(folder.id)}
          draggable={editingFolder !== folder.id}
          onDragStart={(e) => handleFolderDragStart(e, folder.id)}
          onDragOver={(e) => handleFolderDragOver(e, folder.id)}
          onDragLeave={handleFolderDragLeave}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {currentFolder?.id === folder.id ? (
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 flex-shrink-0" />
            )}
            
            {editingFolder === folder.id ? (
              <input
                type="text"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameFolder(folder.id, editFolderName);
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null);
                    setEditFolderName('');
                  }
                }}
                onBlur={() => {
                  if (editFolderName.trim()) {
                    handleRenameFolder(folder.id, editFolderName);
                  } else {
                    setEditingFolder(null);
                    setEditFolderName('');
                  }
                }}
                className="flex-1 px-2 py-1 text-sm bg-slate-600 border border-slate-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <>
                <span className="text-sm font-medium truncate">{folder.name}</span>
                {folder.fileCount !== undefined && folder.fileCount > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-600 text-slate-300 flex-shrink-0">
                    {folder.fileCount}
                  </span>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {(draggedFolder && draggedFolder !== folder.id) || isDraggingFiles && (
              <Move className="w-3 h-3 text-slate-500" />
            )}
            <button
              onClick={(e) => handleFolderMenuClick(e, folder.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-600 transition-all duration-200"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Folder Menu - Fixed positioning */}
        {selectedFolderMenu === folder.id && (
          <div className="absolute left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 w-48 z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreateFolderParent(folder.id);
                setShowCreateFolder(true);
                setSelectedFolderMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>New Subfolder</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(folder.id);
                setEditFolderName(folder.name);
                setSelectedFolderMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <Edit3 className="w-4 h-4" />
              <span>Rename</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder.id);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Folder</span>
            </button>
          </div>
        )}

        {/* Render children */}
        {folder.children && folder.children.length > 0 && (
          <div>
            {renderFolderTree(folder.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const renderBreadcrumb = () => {
    if (!currentProject) return null;

    const breadcrumbs = [currentProject.name];
    
    if (currentFolder) {
      const path = getFolderPath(currentFolder.id);
      breadcrumbs.push(...path);
    }

    return (
      <div className="flex items-center space-x-2 text-sm text-slate-400 mb-4">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="w-4 h-4" />}
            <span className={index === breadcrumbs.length - 1 ? 'text-white font-medium' : ''}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex">
      {/* Folder Sidebar */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Projects</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentProject.color }}
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{currentProject.name}</h2>
              {currentProject.description && (
                <p className="text-sm text-slate-400 truncate">{currentProject.description}</p>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => {
                setCreateFolderParent(currentFolder?.id || null);
                setShowCreateFolder(true);
              }}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>New Folder</span>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Project Root */}
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
              !currentFolder
                ? 'bg-blue-600 text-white'
                : dragOverFolder === null
                ? 'bg-blue-500/20 border-2 border-blue-500 border-dashed'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            onClick={handleProjectRootClick}
            onDragOver={(e) => handleFolderDragOver(e, null)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(e) => handleFolderDrop(e, null)}
          >
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4" />
              <span className="text-sm font-medium">Project Root</span>
            </div>
            {isDraggingFiles && (
              <Move className="w-3 h-3 text-slate-500" />
            )}
          </div>

          {/* Folder Tree */}
          {folderTree.length > 0 && (
            <div className="space-y-1">
              {renderFolderTree(folderTree)}
            </div>
          )}

          {folderTree.length === 0 && (
            <div className="text-center py-8">
              <Folder className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No folders yet</p>
              <p className="text-slate-600 text-xs">Create your first folder to organize files</p>
            </div>
          )}
        </div>

        {/* Create Folder Modal */}
        {showCreateFolder && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96">
              <h3 className="text-lg font-bold text-white mb-4">
                Create New Folder
                {createFolderParent && (
                  <span className="text-sm font-normal text-slate-400 block">
                    in {folderTree.find(f => f.id === createFolderParent)?.name || 'Unknown Folder'}
                  </span>
                )}
              </h3>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Folder name..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                autoFocus
              />
              <div className="flex space-x-3">
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                    setCreateFolderParent(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-6">
          {/* Breadcrumb and Search */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              {renderBreadcrumb()}
            </div>
            
            {/* Search Bar */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search files in this project..."
                value={searchFilters.query}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchFilters.query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {filesLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading files...</p>
              </div>
            </div>
          ) : filesError ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-400 text-2xl">⚠️</span>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Something went wrong</h3>
                <p className="text-slate-400 mb-6">{filesError}</p>
                <button 
                  onClick={refreshFiles}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <FileGrid
              files={filteredFiles}
              onFileClick={handleFileClick}
              onFileDoubleClick={handleFileDoubleClick}
              onFileDelete={handleFileDelete}
              onToggleFavorite={handleToggleFavorite}
              onFileUpdate={handleFileUpdate}
              onFileMove={handleFileMove}
              onFilesDragStart={handleFilesDragStart}
              onFilesDragEnd={handleFilesDragEnd}
              currentPage={1}
              totalPages={1}
              totalCount={filteredTotalCount}
              hasNextPage={false}
              hasPrevPage={false}
              onNextPage={() => {}}
              onPrevPage={() => {}}
              onGoToPage={() => {}}
              viewTitle={currentFolder ? currentFolder.name : `${currentProject.name} - Root`}
              viewDescription={
                searchFilters.query 
                  ? `${filteredCount} files found for "${searchFilters.query}"` 
                  : filteredCount === 0 
                    ? `This ${currentFolder ? 'folder' : 'project location'} is empty`
                    : `${filteredCount} files in ${currentFolder ? 'folder' : 'project root'}`
              }
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortDirection={sortDirection}
              onSortDirectionChange={setSortDirection}
              filterType={filterType}
              onFilterTypeChange={setFilterType}
              showFilters={true}
            />
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        isOpen={showPreview}
        onClose={handlePreviewClose}
        onUpdate={handleFileUpdate}
        onDelete={handleFileDelete}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
};

export default ProjectView;