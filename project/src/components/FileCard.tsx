import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  File,
  MoreVertical,
  Check
} from 'lucide-react';
import FileMenuDropdown from './FileMenuDropdown';

export interface FileItem {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  size: string;
  modifiedDate: string;
  thumbnail?: string;
  isFavorite?: boolean;
  tags?: string[];
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
  workspaceId: string;
  projectId?: string;
  folderId?: string;
}

interface FileCardProps {
  file: FileItem;
  onClick?: (file: FileItem) => void;
  onDoubleClick?: (file: FileItem) => void;
  onDelete?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string) => void;
  onUpdate?: (fileId: string, updates: Partial<FileItem>) => void;
  onMove?: (fileId: string, projectId: string | null, folderId: string | null) => void;
  isSelected?: boolean;
  onSelectionChange?: (fileId: string, selected: boolean) => void;
  selectionMode?: boolean;
  className?: string;
}

const FileCard: React.FC<FileCardProps> = memo(({ 
  file, 
  onClick, 
  onDoubleClick,
  onDelete,
  onToggleFavorite,
  onUpdate,
  onMove,
  isSelected = false,
  onSelectionChange,
  selectionMode = false,
  className = '' 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const getFileIcon = (type: FileItem['type']) => {
    const iconClass = "w-6 h-6";
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

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleRename = (newName: string) => {
    onUpdate?.(file.id, { name: newName });
    setShowMenu(false);
  };

  const handleTagsUpdate = (newTags: string[]) => {
    onUpdate?.(file.id, { tags: newTags });
    setShowMenu(false);
  };

  const handleMove = async (fileId: string, projectId: string | null, folderId: string | null) => {
    try {
      // Update local state
      onUpdate?.(fileId, { 
        projectId: projectId || undefined, 
        folderId: folderId || undefined 
      });

      // Call the move callback if provided
      onMove?.(fileId, projectId, folderId);
      
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to move file:', error);
      alert('Failed to move file. Please try again.');
    }
  };

  const handleToggleFavorite = () => {
    onToggleFavorite?.(file.id);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
      onDelete?.(file.id);
    }
    setShowMenu(false);
  };

  const handleDownload = async () => {
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
    setShowMenu(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Single click always triggers selection if handler is available
    if (onSelectionChange) {
      e.preventDefault();
      onSelectionChange(file.id, !isSelected);
      return;
    }

    // Fallback to regular click if no selection handler
    onClick?.(file);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't trigger double click in selection mode
    if (selectionMode || onSelectionChange) {
      e.preventDefault();
      return;
    }

    onDoubleClick?.(file);
  };

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange?.(file.id, !isSelected);
  };

  // Only show actual tags, no placeholder tags
  const displayTags = file.tags && file.tags.length > 0 ? file.tags : [];

  return (
    <div className="relative">
      <div
        className={`group bg-slate-800 border rounded-xl overflow-hidden hover:bg-slate-750 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer transform hover:scale-105 ${
          isSelected 
            ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/20' 
            : 'border-slate-700 hover:border-slate-600'
        } ${className}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Thumbnail/Preview Area */}
        <div className="relative h-40 bg-slate-700 flex items-center justify-center">
          {file.thumbnail ? (
            <img
              src={file.thumbnail}
              alt={file.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full space-y-2">
              {getFileIcon(file.type)}
              <span className="text-xs text-slate-400 text-center px-2 truncate max-w-full">
                {file.originalName}
              </span>
            </div>
          )}
          
          {/* Selection Checkbox */}
          {(selectionMode || isSelected || onSelectionChange) && (
            <div className="absolute top-2 left-2">
              <button
                onClick={handleSelectionClick}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-black bg-opacity-50 border-white border-opacity-70 hover:bg-opacity-70'
                }`}
              >
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            </div>
          )}
          
          {/* Favorite indicator */}
          {file.isFavorite && (
            <div className={`absolute ${(selectionMode || isSelected) && onSelectionChange ? 'top-2 right-2' : 'top-2 left-2'}`}>
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">★</span>
              </div>
            </div>
          )}
          
          {/* Three-dot menu button */}
          <button
            ref={buttonRef}
            onClick={handleMenuClick}
            className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* File Info */}
        <div className="p-4">
          {/* File name */}
          <h3 className={`font-medium mb-3 truncate transition-colors duration-200 ${
            isSelected ? 'text-blue-400' : 'text-white group-hover:text-blue-400'
          }`}>
            {file.name}
          </h3>

          {/* Tags - only show if there are actual tags */}
          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {displayTags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-colors duration-200"
                >
                  {tag}
                </span>
              ))}
              {displayTags.length > 3 && (
                <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-md">
                  +{displayTags.length - 3}
                </span>
              )}
            </div>
          )}
          
          {/* Show "No tags" if no tags exist */}
          {displayTags.length === 0 && (
            <div className="text-xs text-slate-500">
              No tags
            </div>
          )}
        </div>
      </div>

      {/* Menu Dropdown - positioned outside the card */}
      {showMenu && (
        <div ref={menuRef} className="absolute top-0 right-0 z-50">
          <FileMenuDropdown
            file={file}
            onClose={() => setShowMenu(false)}
            onRename={handleRename}
            onTagsUpdate={handleTagsUpdate}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onMove={handleMove}
          />
        </div>
      )}
    </div>
  );
});

FileCard.displayName = 'FileCard';

export default FileCard;