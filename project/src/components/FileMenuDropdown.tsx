import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit3, 
  Share2, 
  Tag, 
  X, 
  Plus, 
  Save, 
  Star, 
  Trash2, 
  Download,
  Move,
  Folder,
  Home,
  CheckCircle
} from 'lucide-react';
import { FileItem } from './FileCard';
import { useProject } from '../contexts/ProjectContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface FileMenuDropdownProps {
  file: FileItem;
  onClose: () => void;
  onRename: (newName: string) => void;
  onShare: () => void;
  onTagsUpdate: (tags: string[]) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onMove?: (fileId: string, projectId: string | null, folderId: string | null) => void;
}

const FileMenuDropdown: React.FC<FileMenuDropdownProps> = ({
  file,
  onClose,
  onRename,
  onShare,
  onTagsUpdate,
  onToggleFavorite,
  onDelete,
  onDownload,
  onMove
}) => {
  const [showRename, setShowRename] = useState(false);
  const [showTagsEdit, setShowTagsEdit] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [editedTags, setEditedTags] = useState<string[]>(file.tags || []);
  const [newTag, setNewTag] = useState('');
  
  const renameRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const { projects, folders } = useProject();
  const { currentWorkspace } = useWorkspace();

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
    if (newName.trim() && newName.trim() !== file.name) {
      onRename(newName.trim());
    }
    setShowRename(false);
  };

  const handleTagsSubmit = () => {
    onTagsUpdate(editedTags);
    setShowTagsEdit(false);
  };

  const addTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  const handleMoveFile = (projectId: string | null, folderId: string | null) => {
    if (onMove) {
      onMove(file.id, projectId, folderId);
    }
    setShowMoveModal(false);
    onClose();
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
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
          placeholder="Enter new name..."
          autoFocus
        />
        <div className="flex space-x-2">
          <button
            onClick={handleRenameSubmit}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
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
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 w-80"
        style={{
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
        
        {/* Current Tags */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {editedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-blue-200 transition-colors duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Add New Tag */}
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, addTag)}
            placeholder="Add tag..."
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addTag}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handleTagsSubmit}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
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
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Move File</h3>
          <button
            onClick={() => setShowMoveModal(false)}
            className="text-slate-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {/* Workspace Root Option */}
          <button
            onClick={() => handleMoveFile(null, null)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
              !file.projectId && !file.folderId
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Workspace Root</span>
            {!file.projectId && !file.folderId && (
              <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">Current</span>
            )}
          </button>

          {/* Projects and Folders */}
          {projects.map((project) => {
            const projectFolders = folders.filter(f => f.project_id === project.id);
            const isCurrentProject = file.projectId === project.id;
            
            return (
              <div key={project.id} className="space-y-1">
                {/* Project Root */}
                <button
                  onClick={() => handleMoveFile(project.id, null)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                    isCurrentProject && !file.folderId
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ml-4 ${
                      file.folderId === folder.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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

          {projects.length === 0 && (
            <div className="text-center py-4">
              <Folder className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">No projects available</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700">
          <button
            onClick={() => setShowMoveModal(false)}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Cancel
          </button>
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
      <button
        onClick={onDownload}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </button>
      
      <button
        onClick={onToggleFavorite}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Star className={`w-4 h-4 ${file.isFavorite ? 'fill-current text-yellow-400' : ''}`} />
        <span>{file.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>
      
      <div className="border-t border-slate-700 my-1"></div>
      
      <button
        onClick={() => setShowRename(true)}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Edit3 className="w-4 h-4" />
        <span>Rename</span>
      </button>
      
      <button
        onClick={() => setShowTagsEdit(true)}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Tag className="w-4 h-4" />
        <span>Edit Tags</span>
      </button>

      <button
        onClick={() => setShowMoveModal(true)}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Move className="w-4 h-4" />
        <span>Move</span>
      </button>
      
      <button
        onClick={handleShare}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </button>
      
      <div className="border-t border-slate-700 my-1"></div>
      
      <button
        onClick={onDelete}
        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors duration-200"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default FileMenuDropdown;