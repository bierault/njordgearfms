import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  File,
  ArrowLeft,
  Calendar,
  HardDrive,
  Tag,
  Copy,
  CheckCircle,
  Eye,
  Share2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FileItem } from './FileCard';

interface SharePageProps {
  fileId: string;
}

const SharePage: React.FC<SharePageProps> = ({ fileId }) => {
  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    loadFile();
  }, [fileId]);

  const loadFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query files table without any authentication or RLS restrictions
      const { data, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('File not found or no longer available');
        } else {
          console.error('Database error:', fetchError);
          setError('Unable to load file information');
        }
        return;
      }

      if (!data) {
        setError('File not found');
        return;
      }

      // Convert database record to FileItem
      const fileItem: FileItem = {
        id: data.id,
        name: data.name,
        type: data.file_category,
        size: formatFileSize(data.file_size),
        modifiedDate: new Date(data.updated_at).toLocaleDateString(),
        thumbnail: data.thumbnail_url || undefined,
        isFavorite: data.is_favorite,
        tags: data.tags || [],
        originalName: data.original_name,
        filePath: data.file_path,
        fileType: data.file_type,
        fileSize: data.file_size,
        workspaceId: data.workspace_id,
        projectId: data.project_id || undefined,
        folderId: data.folder_id || undefined,
      };

      setFile(fileItem);

      // Get public URL for preview (if it's an image or video)
      if (fileItem.type === 'image' || fileItem.type === 'video') {
        try {
          const { data: urlData } = await supabase.storage
            .from('files')
            .getPublicUrl(fileItem.filePath);
          
          if (urlData?.publicUrl) {
            setFileUrl(urlData.publicUrl);
          }
        } catch (urlError) {
          console.warn('Could not get public URL:', urlError);
        }
      }

    } catch (err) {
      console.error('Error loading file:', err);
      setError('Failed to load file. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: FileItem['type']) => {
    const iconClass = "w-16 h-16";
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

  const handleDownload = async () => {
    if (!file) return;

    try {
      setDownloading(true);
      
      // Try to download the file from storage
      const { data, error } = await supabase.storage
        .from('files')
        .download(file.filePath);

      if (error) {
        console.error('Download error:', error);
        throw new Error('File download failed. The file may have been moved or deleted.');
      }

      // Create download link
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
      alert(error instanceof Error ? error.message : 'Failed to download file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = window.location.href;
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const goBack = () => {
    // Try to go back in history, or go to a default URL
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">File Not Available</h3>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            {error || 'The file you\'re looking for doesn\'t exist, has been removed, or the link has expired.'}
          </p>
          <div className="space-y-3">
            <button 
              onClick={goBack}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Go Back
            </button>
            <p className="text-xs text-slate-500">
              If you believe this is an error, please contact the person who shared this file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={goBack}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Shared File</h1>
              <p className="text-slate-400 text-sm">Public file sharing via FileVault</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">FileVault</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Preview Section */}
            <div className="flex-1 p-8">
              <div className="bg-slate-900 rounded-lg p-8 h-full flex items-center justify-center min-h-[500px]">
                {file.type === 'image' && fileUrl ? (
                  <img
                    src={fileUrl}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    onError={() => setFileUrl(null)}
                  />
                ) : file.type === 'video' && fileUrl ? (
                  <video
                    controls
                    className="max-w-full max-h-full rounded-lg shadow-lg"
                    onError={() => setFileUrl(null)}
                  >
                    <source src={fileUrl} type={file.fileType} />
                    Your browser does not support the video tag.
                  </video>
                ) : file.thumbnail ? (
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-center">
                    {getFileIcon(file.type)}
                    <p className="text-slate-400 mt-4 text-lg font-medium">{file.originalName}</p>
                    <p className="text-slate-500 text-sm mt-2">
                      {file.type === 'document' ? 'Document preview not available' :
                       file.type === 'audio' ? 'Audio preview not available' :
                       file.type === 'archive' ? 'Archive preview not available' :
                       'Preview not available'}
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                      Click download to view the full file
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Details Section */}
            <div className="w-full lg:w-96 p-8 border-t lg:border-t-0 lg:border-l border-slate-700">
              <div className="space-y-6">
                {/* File Name */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{file.name}</h2>
                  <p className="text-slate-400">{file.originalName}</p>
                </div>

                {/* File Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <File className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase">Type</span>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white">
                      {file.type.charAt(0).toUpperCase() + file.type.slice(1)}
                    </span>
                  </div>
                  
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <HardDrive className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase">Size</span>
                    </div>
                    <p className="text-white font-medium">{file.size}</p>
                  </div>
                </div>

                {/* File Format */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    File Format
                  </label>
                  <p className="text-slate-300 font-mono text-sm bg-slate-700 px-3 py-2 rounded-lg">
                    {file.fileType || 'Unknown'}
                  </p>
                </div>

                {/* Last Modified */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Last Modified
                  </label>
                  <p className="text-slate-300">{formatDate(file.modifiedDate)}</p>
                </div>

                {/* Tags */}
                {file.tags && file.tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      <Tag className="w-4 h-4 inline mr-1" />
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {file.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-slate-700 space-y-3">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    <Download className="w-5 h-5" />
                    <span>{downloading ? 'Downloading...' : 'Download File'}</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>Copy Share Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* File Stats */}
                <div className="pt-4 border-t border-slate-700">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Views</span>
                      </div>
                      <p className="text-white font-bold">-</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                        <Download className="w-4 h-4" />
                        <span className="text-xs">Downloads</span>
                      </div>
                      <p className="text-white font-bold">-</p>
                    </div>
                  </div>
                </div>

                {/* Share Info */}
                <div className="pt-4 border-t border-slate-700">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Share2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-xs text-slate-500">
                      This file was shared with you via FileVault
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Secure file sharing platform
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharePage;