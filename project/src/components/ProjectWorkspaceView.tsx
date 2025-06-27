import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Upload,
  X,
  FileText,
  Loader,
  Folder,
  Home,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  Save,
  Move
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import FileCard, { FileItem } from './FileCard';
import UploadModal from './UploadModal';

interface ProjectWorkspaceViewProps {
  project: any;
  onBack: () => void;
}

type SortOption = 'name' | 'date' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

// Convert database file to FileItem
const convertFileRecord = (record: any): FileItem => ({
  id: record.id,
  name: record.name,
  type: record.file_category,
  size: formatFileSize(record.file_size),
  modifiedDate: new Date(record.updated_at).toLocaleDateString(),
  thumbnail: record.thumbnail_url || undefined,
  isFavorite: record.is_favorite,
  tags: record.tags || [],
  originalName: record.original_name,
  filePath: record.file_path,
  fileType: record.file_type,
  fileSize: record.file_size,
  fileUrl: record.file_url || undefined,
  workspaceId: record.workspace_id,
  projectId: record.project_id || undefined,
  folderId: record.folder_id || undefined,
});

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Create Folder Modal - REWRITTEN for better reliability
const CreateFolderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  currentProject: any;
  currentFolder: any;
}> = ({ isOpen, onClose, onSubmit, currentProject, currentFolder }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Folder name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Folder name must be 50 characters or less');
      return;
    }

    // Check for invalid characters
    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      setError('Folder name contains invalid characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ name: trimmedName });
      // Modal will be closed by parent component on success
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Create Folder</h3>
            <button 
              onClick={onClose} 
              disabled={isSubmitting}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Folder className="w-4 h-4 inline mr-1" />
                Folder Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null); // Clear error when user types
                }}
                placeholder="Enter folder name..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={isSubmitting}
                maxLength={50}
              />
              {error && (
                <p className="text-red-400 text-sm mt-1">{error}</p>
              )}
            </div>

            <div className="text-sm text-slate-500">
              <p>Creating folder in:</p>
              <p className="font-medium text-slate-300">
                {currentProject?.name}
                {currentFolder && ` > ${currentFolder.path}`}
                {!currentFolder && ' > Root'}
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Create Folder</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({ project, onBack }) => {
  const { currentWorkspace } = useWorkspace();
  
  // Data state
  const [folders, setFolders] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Enhanced drag and drop state for both files and folders
  const [draggedItem, setDraggedItem] = useState<{id: string, type: 'file' | 'folder'} | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (project) {
      loadFolders();
      loadFiles();
    }
  }, [project, currentFolder]);

  const loadFolders = async () => {
    try {
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('project_id', project.id)
        .order('path');

      if (foldersError) throw foldersError;

      setFolders(foldersData || []);
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('files')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('project_id', project.id)
        .is('deleted_at', null);

      // Filter by folder
      if (currentFolder) {
        query = query.eq('folder_id', currentFolder.id);
      } else {
        query = query.is('folder_id', null);
      }

      const { data: filesData, error: filesError } = await query
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      const convertedFiles = (filesData || []).map(convertFileRecord);
      setFiles(convertedFiles);

    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async (folderData: any) => {
    try {
      console.log('Creating folder:', folderData.name, 'in project:', project.id);
      
      const { data, error } = await supabase
        .from('folders')
        .insert([{
          name: folderData.name,
          project_id: project.id,
          parent_id: currentFolder?.id || null
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating folder:', error);
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      console.log('Folder created successfully:', data);
      
      // Reload folders to get updated tree
      await loadFolders();
      setShowCreateFolder(false);
      
    } catch (err) {
      console.error('Error creating folder:', err);
      throw err; // Re-throw to be handled by modal
    }
  };

  const moveFolder = async (folderId: string, newParentId: string | null) => {
    try {
      // Prevent moving folder into itself or its children
      if (folderId === newParentId) return;
      
      // Check if target is a child of the folder being moved
      const isChildOfMovedFolder = (targetId: string | null, movedFolderId: string): boolean => {
        if (!targetId) return false;
        
        const targetFolder = folders.find(f => f.id === targetId);
        if (!targetFolder) return false;
        
        if (targetFolder.parent_id === movedFolderId) return true;
        
        return isChildOfMovedFolder(targetFolder.parent_id, movedFolderId);
      };

      if (newParentId && isChildOfMovedFolder(newParentId, folderId)) {
        console.log('Cannot move folder into its own subfolder');
        return;
      }

      const { error } = await supabase
        .from('folders')
        .update({ parent_id: newParentId })
        .eq('id', folderId);

      if (error) throw error;

      await loadFolders(); // Reload to get updated tree structure
      console.log('Folder moved successfully');
    } catch (err) {
      console.error('Error moving folder:', err);
    }
  };

  // NEW: Move file to folder
  const moveFile = async (fileId: string, newFolderId: string | null) => {
    try {
      console.log('Moving file:', fileId, 'to folder:', newFolderId);
      
      const { error } = await supabase
        .from('files')
        .update({ 
          folder_id: newFolderId,
          project_id: project.id // Ensure it stays in the same project
        })
        .eq('id', fileId);

      if (error) throw error;

      await loadFiles(); // Reload files to update the view
      console.log('File moved successfully');
    } catch (err) {
      console.error('Error moving file:', err);
    }
  };

  const selectFolder = (folder: any) => {
    setCurrentFolder(folder);
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Build folder tree
  const folderTree = useMemo(() => {
    const folderMap = new Map();
    const rootFolders: any[] = [];

    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id);
      if (folder.parent_id) {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(folderNode);
        } else {
          rootFolders.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });

    return rootFolders;
  }, [folders]);

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.originalName.toLowerCase().includes(query) ||
        (file.tags && file.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      if (filterType === 'favorites') {
        result = result.filter(file => file.isFavorite);
      } else {
        result = result.filter(file => file.type === filterType);
      }
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.modifiedDate).getTime() - new Date(b.modifiedDate).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, searchQuery, filterType, sortBy, sortDirection]);

  // Enhanced drag and drop handlers for both files and folders
  const handleDragStart = (e: React.DragEvent, itemId: string, itemType: 'file' | 'folder') => {
    setDraggedItem({ id: itemId, type: itemType });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${itemType}:${itemId}`);
  };

  const handleDragOver = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(targetFolderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const { id: draggedId, type: draggedType } = draggedItem;
    
    // Handle folder drops
    if (draggedType === 'folder' && draggedId !== targetFolderId) {
      await moveFolder(draggedId, targetFolderId);
    }
    
    // Handle file drops
    if (draggedType === 'file') {
      await moveFile(draggedId, targetFolderId);
    }
    
    setDraggedItem(null);
    setDragOverFolder(null);
  };

  const renderFolder = (folder: any, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = currentFolder?.id === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const isDraggedOver = dragOverFolder === folder.id;
    const isDragging = draggedItem?.type === 'folder' && draggedItem?.id === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${
            isSelected 
              ? 'bg-blue-600 text-white' 
              : isDraggedOver
              ? 'bg-green-600 text-white'
              : isDragging
              ? 'opacity-50'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => selectFolder(folder)}
          draggable
          onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-slate-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate flex-1">{folder.name}</span>
          {isDraggedOver && (
            <Move className="w-3 h-3 text-green-400" />
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {folder.children.map((child: any) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex h-full bg-slate-900">
      {/* Folder Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Folders</h3>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
              title="Create Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Project Root */}
          <div
            className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 mb-1 ${
              !currentFolder 
                ? 'bg-blue-600 text-white' 
                : dragOverFolder === null
                ? 'bg-green-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            onClick={() => selectFolder(null)}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            <Home className="w-4 h-4" />
            <span className="text-sm">Project Root</span>
            {dragOverFolder === null && draggedItem && (
              <Move className="w-3 h-3 text-green-400" />
            )}
          </div>
        </div>

        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {folderTree.map(folder => renderFolder(folder))}
          </div>
          
          {folderTree.length === 0 && (
            <div className="text-center py-8">
              <Folder className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No folders yet</p>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="text-blue-400 hover:text-blue-300 text-sm mt-1"
              >
                Create your first folder
              </button>
            </div>
          )}
        </div>

        {/* Drag Instructions */}
        {draggedItem && (
          <div className="p-3 border-t border-slate-700 bg-slate-700/50">
            <p className="text-xs text-slate-400 text-center">
              Drop on a folder or Project Root to move {draggedItem.type}
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">{project.name}</h1>
                {currentFolder && (
                  <p className="text-sm text-slate-400">{currentFolder.path}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
          </div>

          {/* Search and Controls */}
          <div className="flex items-center justify-between px-4 pb-4 space-x-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              <div className="text-sm text-slate-400">
                {filteredAndSortedFiles.length} files
              </div>

              {/* Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Files</option>
                <option value="favorites">Favorites</option>
                <option value="document">Documents</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="archive">Archives</option>
              </select>

              {/* Sort */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">Date</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                  <option value="type">Type</option>
                </select>

                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                >
                  {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>

              {/* View Mode */}
              <div className="flex items-center bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors duration-200 ${
                    viewMode === 'list'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Display */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading files...</p>
            </div>
          ) : filteredAndSortedFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Files</h3>
              <p className="text-slate-400">
                {currentFolder 
                  ? `No files in "${currentFolder.name}" folder.`
                  : `No files in "${project.name}" project.`
                }
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {filteredAndSortedFiles.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file.id, 'file')}
                  className={`transition-opacity duration-200 ${
                    draggedItem?.type === 'file' && draggedItem?.id === file.id ? 'opacity-50' : ''
                  }`}
                >
                  <FileCard
                    file={file}
                    onClick={() => console.log('File clicked:', file)}
                    onDoubleClick={() => console.log('File double-clicked:', file)}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Modified</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredAndSortedFiles.map((file) => (
                    <tr 
                      key={file.id} 
                      className={`hover:bg-slate-700 cursor-pointer transition-all duration-200 ${
                        draggedItem?.type === 'file' && draggedItem?.id === file.id ? 'opacity-50' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, file.id, 'file')}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {file.isFavorite && <span className="text-yellow-400">★</span>}
                          <span className="text-white font-medium">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                          {file.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{file.size}</td>
                      <td className="px-6 py-4 text-slate-300">{file.modifiedDate}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {file.tags?.slice(0, 2).map((tag) => (
                            <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-600 text-slate-300">
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
          )}
        </div>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          loadFiles();
          setShowUploadModal(false);
        }}
        projectContext={true}
        projectId={project.id}
        folderId={currentFolder?.id}
      />

      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={createFolder}
        currentProject={project}
        currentFolder={currentFolder}
      />
    </div>
  );
};

export default ProjectWorkspaceView;