import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit3, 
  Share2, 
  X, 
  Save, 
  Star, 
  Download,
  Move,
  Folder,
  Home,
  CheckCircle,
  Tag,
  Trash2,
  Eye,
  Info,
  AlertTriangle,
  Loader
} from 'lucide-react';
import { FileItem } from './FileCard';
import { useProject } from '../contexts/ProjectContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import TagInput from './TagInput';

interface FileMenuDropdownProps {
  file: FileItem;
  onClose: () => void;
  onRename: (newName: string) => void;
  onShare?: () => void;
  onTagsUpdate: (tags: string[]) => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onMove?: (fileId: string, projectId: string | null, folderId: string | null) => void;
  onDelete?: (fileId: string) => void;
  onShowDetails?: () => void;
  onShowPreview?: () => void;
  userRole?: 'admin' | 'employee';
  userProjectAccess?: string[];
}

const FileMenuDropdown: React.FC<FileMenuDropdownProps> = ({
  file,
  onClose,
  onRename,
  onShare,
  onTagsUpdate,
  onToggleFavorite,
  onDownload,
  onMove,
  onDelete,
  onShowDetails,
  onShowPreview,
  userRole = 'admin',
  userProjectAccess = []
}) => {
  const [showRename, setShowRename] = useState(false);
  const [showTagsEdit, setShowTagsEdit] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [editedTags, setEditedTags] = useState<string[]>(file.tags || []);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const renameRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const { projects, folders } = useProject();
  const { currentWorkspace } = useWorkspace();

  // Load all projects and folders when move modal is opened
  useEffect(() => {
    if (showMoveModal && currentWorkspace?.id) {
      loadAllProjectsAndFolders();
    }
  }, [showMoveModal, currentWorkspace]);

  const loadAllProjectsAndFolders = async () => {
    if (!currentWorkspace?.id) return;

    setLoadingProjects(true);
    try {
      const { supabase } = await import('../lib/supabase');
      
      // Load all projects for current workspace
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      if (projectsError) {
        console.error('Error loading projects:', projectsError);
        setAllProjects([]);
      } else {
        setAllProjects(projectsData || []);
      }

      // Load all folders for all projects in workspace
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select(`
          *,
          project:projects!inner(workspace_id)
        `)
        .eq('project.workspace_id', currentWorkspace.id)
        .order('path');

      if (foldersError) {
        console.error('Error loading folders:', foldersError);
        setAllFolders([]);
      } else {
        setAllFolders(foldersData || []);
      }

    } catch (error) {
      console.error('Error loading projects and folders:', error);
      setAllProjects([]);
      setAllFolders([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Check permissions
  const canEdit = userRole === 'admin';
  const canEditTags = userRole === 'admin';
  const canMove = true; // Allow all users to move files
  const canDelete = userRole === 'admin';
  
  // For employees, check if they have access to this file's project
  const hasProjectAccess = userRole === 'admin' || 
    !file.projectId || 
    userProjectAccess.includes(file.projectId);

  // Filter projects based on user access
  const accessibleProjects = userRole === 'admin' 
    ? allProjects 
    : allProjects.filter(p => userProjectAccess.includes(p.id));

  // Close submenus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showRename && renameRef.current && !renameRef.current.contains(event.target as Node)) {
        setShowRename(false);
      }
      if (showTagsEdit && tagsRef.current && !tagsRef.current.contains(event.target as Node)) {
        setShowTagsEdit(false);
      }
    };

    if (showRename || showTagsEdit) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRename, showTagsEdit]);

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== file.name && canEdit) {
      onRename(newName.trim());
    }
    setShowRename(false);
  };

  const handleTagsSubmit = () => {
    if (canEditTags) {
      onTagsUpdate(editedTags);
    }
    setShowTagsEdit(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  const handleMoveFile = (projectId: string | null, folderId: string | null) => {
    if (onMove && canMove) {
      console.log('Moving file:', file.id, 'to project:', projectId, 'folder:', folderId);
      onMove(file.id, projectId, folderId);
    }
    setShowMoveModal(false);
    onClose();
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete || !canDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(file.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      // Generate public share URL
      const shareUrl = `${window.location.origin}/share/${file.id}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      // Open in new tab
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      
      // Show success message
      setShowShareSuccess(true);
      setTimeout(() => {
        setShowShareSuccess(false);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to share file:', error);
      
      // Fallback for browsers that don't support clipboard API
      const shareUrl = `${window.location.origin}/share/${file.id}`;
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Open in new tab
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      
      // Show success message
      setShowShareSuccess(true);
      setTimeout(() => {
        setShowShareSuccess(false);
        onClose();
      }, 2000);
    }
  };

  const handlePreview = () => {
    if (onShowPreview) {
      onShowPreview();
    }
    onClose();
  };

  const handleDetails = () => {
    if (onShowDetails) {
      onShowDetails();
    }
    onClose();
  };

  // Don't show menu if employee doesn't have access to this file's project
  if (!hasProjectAccess) {
    return null;
  }

  if (showShareSuccess) {
    return (
      <div 
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 w-64"
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-white font-medium">Share link created!</p>
            <p className="text-slate-400 text-sm">Link copied and opened in new tab</p>
          </div>
        </div>
      </div>
    );
  }

  if (showRename) {
    return (
      <div 
        ref={renameRef}
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 w-64"
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Rename File</h3>
          <button
            onClick={() => setShowRename(false)}
            className="text-slate-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, handleRenameSubmit)}
          disabled={!canEdit}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Enter new name..."
          autoFocus
        />
        <div className="flex space-x-2">
          <button
            onClick={handleRenameSubmit}
            disabled={!canEdit}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
          <button
            onClick={() => setShowRename(false)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (showTagsEdit) {
    return (
      <div 
        ref={tagsRef}
        className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 w-80 z-[90]"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Edit Tags</h3>
          <button
            onClick={() => setShowTagsEdit(false)}
            className="text-slate-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <TagInput
          tags={editedTags}
          onTagsChange={setEditedTags}
          placeholder="Add tag..."
          disabled={!canEditTags}
          className="mb-3"
        />

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handleTagsSubmit}
            disabled={!canEditTags}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            <Save className="w-3 h-3" />
            <span>Save Tags</span>
          </button>
          <button
            onClick={() => setShowTagsEdit(false)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (showMoveModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90] p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md max-h-96 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Move File</h3>
              <button
                onClick={() => setShowMoveModal(false)}
                className="text-slate-400 hover:text-white transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mt-1">Choose destination for "{file.name}"</p>
          </div>

          <div className="p-4 max-h-80 overflow-y-auto">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-slate-400">Loading projects...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Workspace Root Option */}
                <button
                  onClick={() => handleMoveFile(null, null)}
                  disabled={!canMove}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                    !file.projectId && !file.folderId
                      ? 'bg-blue-600 text-white'
                      : canMove
                      ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>Workspace Root</span>
                  {!file.projectId && !file.folderId && (
                    <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">Current</span>
                  )}
                </button>

                {/* Projects and Folders */}
                {accessibleProjects.map((project) => {
                  const projectFolders = allFolders.filter(f => f.project_id === project.id);
                  const isCurrentProject = file.projectId === project.id;
                  
                  return (
                    <div key={project.id} className="space-y-1">
                      {/* Project Root */}
                      <button
                        onClick={() => handleMoveFile(project.id, null)}
                        disabled={!canMove}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                          isCurrentProject && !file.folderId
                            ? 'bg-blue-600 text-white'
                            : canMove
                            ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            : 'text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate">{project.name}</span>
                        {isCurrentProject && !file.folderId && (
                          <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">Current</span>
                        )}
                      </button>

                      {/* Project Folders */}
                      {projectFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => handleMoveFile(project.id, folder.id)}
                          disabled={!canMove}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ml-4 ${
                            file.folderId === folder.id
                              ? 'bg-blue-600 text-white'
                              : canMove
                              ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                              : 'text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Folder className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{folder.name}</span>
                          {file.folderId === folder.id && (
                            <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">Current</span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}

                {accessibleProjects.length === 0 && !loadingProjects && (
                  <div className="text-center py-4">
                    <Folder className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">No accessible projects</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Delete Confirmation Modal
  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90] p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete File</h3>
                <p className="text-slate-400 text-sm">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete <span className="font-medium text-white">"{file.name}"</span>?
            </p>

            <div className="flex space-x-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || !canDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </div>
                ) : (
                  "Delete File"
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 w-48"
      style={{
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
    >
      {/* Preview */}
      <button
        onClick={handlePreview}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Eye className="w-4 h-4" />
        <span>Preview</span>
      </button>

      {/* Details */}
      <button
        onClick={handleDetails}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Info className="w-4 h-4" />
        <span>Details</span>
      </button>

      <div className="border-t border-slate-700 my-1"></div>

      {/* Rename */}
      <button
        onClick={() => setShowRename(true)}
        disabled={!canEdit}
        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200 ${
          canEdit 
            ? 'text-slate-300 hover:text-white hover:bg-slate-700' 
            : 'text-slate-500 cursor-not-allowed'
        }`}
      >
        <Edit3 className="w-4 h-4" />
        <span>Rename</span>
      </button>
      
      {/* Edit Tags */}
      <button
        onClick={() => setShowTagsEdit(true)}
        disabled={!canEditTags}
        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200 ${
          canEditTags 
            ? 'text-slate-300 hover:text-white hover:bg-slate-700' 
            : 'text-slate-500 cursor-not-allowed'
        }`}
      >
        <Tag className="w-4 h-4" />
        <span>Edit Tags</span>
      </button>

      {/* Move */}
      <button
        onClick={() => setShowMoveModal(true)}
        disabled={!canMove}
        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200 ${
          canMove 
            ? 'text-slate-300 hover:text-white hover:bg-slate-700' 
            : 'text-slate-500 cursor-not-allowed'
        }`}
      >
        <Move className="w-4 h-4" />
        <span>Move</span>
      </button>
      
      {/* Share */}
      <button
        onClick={handleShare}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </button>

      {/* Download */}
      <button
        onClick={onDownload}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </button>
      
      {/* Favorite */}
      <button
        onClick={onToggleFavorite}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Star className={`w-4 h-4 ${file.isFavorite ? 'fill-current text-yellow-400' : ''}`} />
        <span>{file.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
      </button>

      {/* Delete option - Show disabled state for employees */}
      <div className="border-t border-slate-700 my-1"></div>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        disabled={!canDelete}
        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200 ${
          canDelete 
            ? 'text-red-400 hover:text-red-300 hover:bg-slate-700' 
            : 'text-slate-500 cursor-not-allowed'
        }`}
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete</span>
      </button>

      {/* Permission Notice for Employees */}
      {userRole === 'employee' && (
        <div className="border-t border-slate-700 mt-1 pt-1">
          <div className="px-4 py-2 text-xs text-slate-500">
            Limited permissions: Contact admin for file management
          </div>
        </div>
      )}
    </div>
  );
};

export default FileMenuDropdown;