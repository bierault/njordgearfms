import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  File,
  MoreVertical,
  Check,
  Eye,
  AlertTriangle,
  Loader
} from 'lucide-react';
import FileMenuDropdown from './FileMenuDropdown';
import VideoPlayer from './VideoPlayer';
import FilePreviewModal from './FilePreviewModal';

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
  onDelete?: (fileId: string) => Promise<void>;
  onToggleFavorite?: (fileId: string) => void;
  onUpdate?: (fileId: string, updates: Partial<FileItem>) => void;
  onMove?: (fileId: string, projectId: string | null, folderId: string | null) => void;
  isSelected?: boolean;
  onSelectionChange?: (fileId: string, selected: boolean) => void;
  selectionMode?: boolean;
  userRole?: 'admin' | 'employee';
  userProjectAccess?: string[];
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
  userRole = 'admin',
  userProjectAccess = [],
  className = '' 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if employee has access to this file's project
  const hasProjectAccess = userRole === 'admin' || 
    !file.projectId || 
    userProjectAccess.includes(file.projectId);

  // Don't render the card at all if employee doesn't have access
  if (userRole === 'employee' && !hasProjectAccess) {
    return null;
  }

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  const getFileIcon = (type: FileItem['type']) => {
    const iconClass = "w-8 h-8";
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

  const getFileUrl = () => {
    if (file.fileUrl) return file.fileUrl;
    
    // Generate Supabase public URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/files/${file.filePath}`;
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.type === 'video') {
      setShowVideoPlayer(true);
    } else {
      setShowPreview(true);
    }
  };

  const handleRename = (newName: string) => {
    if (userRole !== 'admin') return;
    onUpdate?.(file.id, { name: newName });
    setShowMenu(false);
  };

  const handleTagsUpdate = (newTags: string[]) => {
    if (userRole !== 'admin') return;
    onUpdate?.(file.id, { tags: newTags });
    setShowMenu(false);
  };

  const handleMove = async (fileId: string, projectId: string | null, folderId: string | null) => {
    if (userRole !== 'admin') return;
    
    try {
      console.log('FileCard: Moving file', fileId, 'to project:', projectId, 'folder:', folderId);
      
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

  const handleDeleteConfirm = async () => {
    if (!onDelete || userRole !== 'admin') return;
    
    setIsDeleting(true);
    try {
      console.log('FileCard: Calling onDelete for file:', file.id);
      await onDelete(file.id);
      console.log('FileCard: Delete completed successfully');
      setShowDeleteConfirm(false);
      setShowMenu(false);
    } catch (error) {
      console.error('FileCard: Delete failed:', error);
      alert('Failed to delete file. Please try again.');
    } finally {
      setIsDeleting(false);
    }
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't handle clicks on menu button or selection checkbox
    if (e.target !== e.currentTarget && 
        !(e.target as Element).closest('.file-card-content')) {
      return;
    }

    e.preventDefault();
    
    // Clear any existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    if (newClickCount === 1) {
      // Start timer for single click
      const timer = setTimeout(() => {
        // Single click - handle selection or regular click
        if (onSelectionChange) {
          onSelectionChange(file.id, !isSelected);
        } else {
          onClick?.(file);
        }
        setClickCount(0);
      }, 250); // 250ms delay to detect double click
      
      setClickTimer(timer);
    } else if (newClickCount === 2) {
      // Double click - open preview
      if (file.type === 'video') {
        setShowVideoPlayer(true);
      } else {
        setShowPreview(true);
      }
      setClickCount(0);
    }
  };

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange?.(file.id, !isSelected);
  };

  const handleShowPreview = () => {
    if (file.type === 'video') {
      setShowVideoPlayer(true);
    } else {
      setShowPreview(true);
    }
    setShowMenu(false);
  };

  const handleShowDetails = () => {
    setShowDetails(true);
    setShowMenu(false);
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

  // Only show actual tags, no placeholder tags
  const displayTags = file.tags && file.tags.length > 0 ? file.tags : [];

  // Show selection circles only when files are actually selected
  const showSelectionCircle = isSelected || selectionMode;

  return (
    <>
      <div className="relative">
        <div
          className={`group bg-slate-800 border rounded-xl overflow-hidden hover:bg-slate-750 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer ${
            isSelected 
              ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/20' 
              : 'border-slate-700 hover:border-slate-600'
          } ${className}`}
          onClick={handleCardClick}
        >
          {/* Image/Preview Area - Nearly 1:1 ratio */}
          <div className="relative aspect-square bg-slate-700 flex items-center justify-center file-card-content">
            {file.type === 'video' ? (
              <VideoPlayer
                src={getFileUrl()}
                poster={file.thumbnail}
                className="w-full h-full"
              />
            ) : file.thumbnail ? (
              <img
                src={file.thumbnail}
                alt={file.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                {getFileIcon(file.type)}
              </div>
            )}
            
            {/* Selection Checkbox - Only show when files are selected */}
            {showSelectionCircle && (
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
              <div className={`absolute ${showSelectionCircle ? 'top-2 right-2' : 'top-2 left-2'}`}>
                <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">★</span>
                </div>
              </div>
            )}
            
            {/* Preview button - Always visible on hover */}
            <button
              onClick={handlePreviewClick}
              className="absolute top-2 right-10 p-1.5 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Preview file"
            >
              <Eye className="w-4 h-4" />
            </button>
            
            {/* Three-dot menu button - Show disabled state for employees */}
            <button
              ref={buttonRef}
              onClick={handleMenuClick}
              disabled={userRole === 'employee' && !hasProjectAccess}
              className={`absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                userRole === 'employee' && !hasProjectAccess ? 'cursor-not-allowed opacity-30' : ''
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* File Info - Clean design without box */}
          <div className="p-3 file-card-content">
            {/* File name */}
            <h3 className={`font-medium text-sm mb-2 truncate transition-colors duration-200 ${
              isSelected ? 'text-blue-400' : 'text-white group-hover:text-blue-400'
            }`}>
              {file.name}
            </h3>

            {/* Tags - only show if there are actual tags with colors */}
            {displayTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayTags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className={`px-2 py-0.5 text-xs rounded-md border transition-colors duration-200 ${getTagColor(tag, index)}`}
                  >
                    {tag}
                  </span>
                ))}
                {displayTags.length > 2 && (
                  <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-md border border-slate-600">
                    +{displayTags.length - 2}
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
              onDelete={() => setShowDeleteConfirm(true)}
              onDownload={handleDownload}
              onMove={handleMove}
              onShowPreview={handleShowPreview}
              onShowDetails={handleShowDetails}
              userRole={userRole}
              userProjectAccess={userProjectAccess}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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
                  disabled={isDeleting || userRole !== 'admin'}
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
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && file.type === 'video' && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative w-full h-full max-w-6xl max-h-full">
            <button
              onClick={() => setShowVideoPlayer(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all duration-200"
            >
              ×
            </button>
            <VideoPlayer
              src={getFileUrl()}
              poster={file.thumbnail}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={showDetails ? file : null}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onUpdate={onUpdate}
        onToggleFavorite={onToggleFavorite}
        userRole={userRole}
      />
    </>
  );
});

FileCard.displayName = 'FileCard';

export default FileCard;