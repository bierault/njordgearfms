import React, { useState, memo } from 'react';
import { 
  X, 
  Download, 
  Star, 
  Edit3, 
  Calendar, 
  HardDrive, 
  Tag, 
  User,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  File,
  Save,
  Link,
  Copy,
  Play,
  Pause
} from 'lucide-react';
import { FileItem } from './FileCard';
import { supabase } from '../lib/supabase';
import AutoTaggingButton from './AutoTaggingButton';
import TagInput from './TagInput';
import VideoPlayer from './VideoPlayer';

interface FilePreviewModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (fileId: string, updates: Partial<FileItem>) => void;
  onToggleFavorite?: (fileId: string) => void;
  userRole?: 'admin' | 'employee';
  isPreviewMode?: boolean;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = memo(({
  file,
  isOpen,
  onClose,
  onUpdate,
  onToggleFavorite,
  userRole = 'admin',
  isPreviewMode = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedFileUrl, setEditedFileUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Check permissions
  const canEdit = userRole === 'admin';
  const canEditTags = userRole === 'admin';

  React.useEffect(() => {
    if (file) {
      setEditedName(file.name);
      setEditedTags(file.tags || []);
      setEditedFileUrl(file.fileUrl || '');
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const getFileIcon = (type: FileItem['type']) => {
    const iconClass = "w-12 h-12";
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

  const handleDownload = async () => {
    try {
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
  };

  const handleSave = async () => {
    if (!onUpdate) return;

    try {
      await onUpdate(file.id, {
        name: editedName,
        tags: editedTags,
        fileUrl: editedFileUrl || undefined
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const handleCopyFileUrl = async () => {
    if (!file.fileUrl) return;

    try {
      await navigator.clipboard.writeText(file.fileUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleTagsUpdated = (newTags: string[]) => {
    if (onUpdate) {
      onUpdate(file.id, { tags: newTags });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white">{isPreviewMode ? "File Preview" : "File Details"}</h2>
            {file.isFavorite && (
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(file.id)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  file.isFavorite 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <Star className={`w-5 h-5 ${file.isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
            {canEdit && !isPreviewMode && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors duration-200"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-140px)]">
          {/* Preview Section */}
          <div className="flex-1 p-6 border-r border-slate-700">
            <div className="bg-slate-900 rounded-lg p-8 h-full flex items-center justify-center min-h-[300px] relative">
              {file.type === 'image' ? (
                <img
                  src={file.thumbnail || getFileUrl()}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onError={(e) => {
                    // Fallback to file URL if thumbnail fails
                    const target = e.target as HTMLImageElement;
                    if (target.src !== getFileUrl()) {
                      target.src = getFileUrl();
                    }
                  }}
                />
              ) : file.type === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <VideoPlayer
                    src={getFileUrl()}
                    poster={file.thumbnail}
                    className="max-w-full max-h-full rounded-lg"
                    showTimer={true}
                  />
                </div>
              ) : file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center">
                  {getFileIcon(file.type)}
                  <p className="text-slate-400 mt-4 text-lg font-medium">{file.originalName}</p>
                  <p className="text-slate-500 text-sm mt-2">No preview available</p>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="w-full lg:w-96 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* File Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  File Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-white font-medium">{file.name}</p>
                )}
              </div>

              {/* Original Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Original Name
                </label>
                <p className="text-slate-300">{file.originalName}</p>
              </div>

              {/* File URL for n8n automation */}
              {!isPreviewMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    <Link className="w-4 h-4 inline mr-1" />
                    File URL (for automation)
                  </label>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={editedFileUrl}
                        onChange={(e) => setEditedFileUrl(e.target.value)}
                        placeholder="Enter external URL for automation..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-500">
                        This URL can be used by automation tools like n8n to reference this file
                      </p>
                    </div>
                  ) : file.fileUrl ? (
                    <div className="flex items-center space-x-2">
                      <p className="text-slate-300 text-sm font-mono bg-slate-700 px-3 py-2 rounded-lg flex-1 truncate">
                        {file.fileUrl}
                      </p>
                      <button
                        onClick={handleCopyFileUrl}
                        className={`p-2 rounded-lg transition-colors duration-200 ${
                          copySuccess 
                            ? 'bg-green-600 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No URL set</p>
                  )}
                </div>
              )}

              {/* File Type & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Type
                  </label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white">
                    {file.type.charAt(0).toUpperCase() + file.type.slice(1)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Format
                  </label>
                  <p className="text-slate-300 text-sm">{file.fileType || 'Unknown'}</p>
                </div>
              </div>

              {/* File Size */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  <HardDrive className="w-4 h-4 inline mr-1" />
                  Size
                </label>
                <p className="text-slate-300">{file.size}</p>
              </div>

              {/* Upload Date */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Last Modified
                </label>
                <p className="text-slate-300">{file.modifiedDate}</p>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-400">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tags
                  </label>
                  {!isEditing && canEditTags && (
                    <AutoTaggingButton
                      fileId={file.id}
                      currentTags={file.tags || []}
                      onTagsUpdated={handleTagsUpdated}
                      className="text-xs"
                    />
                  )}
                </div>
                {isEditing && canEditTags ? (
                  <TagInput
                    tags={editedTags}
                    onTagsChange={setEditedTags}
                    placeholder="Add tag..."
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {file.tags && file.tags.length > 0 ? (
                      file.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No tags</p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-700 space-y-3">
                {isEditing ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                )}
              </div>

              {/* Permission Notice for Employees */}
              {userRole === 'employee' && !isPreviewMode && (
                <div className="pt-4 border-t border-slate-700">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">
                      <User className="w-3 h-3 inline mr-1" />
                      Employee account: Limited permissions. Contact an admin for additional file management options.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

FilePreviewModal.displayName = 'FilePreviewModal';

export default FilePreviewModal;