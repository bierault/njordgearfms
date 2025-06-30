import React, { useState, useRef } from 'react';
import { X, Upload, File, CheckCircle, AlertCircle, Loader, Zap, Clock } from 'lucide-react';
import { useFileUpload } from '../hooks/useFileUpload';
import { FileRecord } from '../lib/supabase';
import TagInput from './TagInput';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (uploadedFiles: any[]) => void;
  projectContext?: boolean;
  projectId?: string;
  folderId?: string;
}

interface RecentUpload extends FileRecord {
  uploadTime: string;
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUploadComplete,
  projectContext = false,
  projectId,
  folderId
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, isUploading, uploadFiles } = useFileUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(files => files.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      console.log('Starting upload process with auto-tagging:', autoTaggingEnabled);
      console.log('Manual tags:', manualTags);
      
      // Determine upload location
      let targetProjectId = projectId;
      let targetFolderId = folderId;
      
      console.log('Upload location:', {
        projectId: targetProjectId,
        folderId: targetFolderId
      });
      
      // Upload files with only manual tags
      const uploadedFiles = await uploadFiles(
        selectedFiles, 
        manualTags, 
        autoTaggingEnabled,
        targetProjectId,
        targetFolderId
      );
      
      console.log('Upload completed:', uploadedFiles);
      
      // Add to recent uploads with timestamp
      if (uploadedFiles && uploadedFiles.length > 0) {
        const newRecentUploads = uploadedFiles.map(file => ({
          ...file,
          uploadTime: new Date().toISOString()
        }));
        setRecentUploads(prev => [...newRecentUploads, ...prev].slice(0, 50)); // Keep last 50 uploads
        
        if (onUploadComplete) {
          onUploadComplete(uploadedFiles);
        }
      }
      
      // Reset form but keep modal open
      setSelectedFiles([]);
      setManualTags([]);
      
      // Don't close modal - let user continue uploading or editing recent uploads
      
    } catch (error) {
      console.error('Upload failed:', error);
      // Don't close modal on error so user can retry
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getTotalSize = () => {
    const total = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    return formatFileSize(total);
  };

  const formatUploadTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const removeRecentUpload = (fileId: string) => {
    setRecentUploads(prev => prev.filter(file => file.id !== fileId));
  };

  const getUploadLocationText = () => {
    if (projectContext && projectId) {
      if (folderId) {
        const folderName = "Selected Folder"; // Ideally get the actual folder name
        return `Project > ${folderName}`;
      }
      return `Project > Root`;
    } else {
      return 'Workspace';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden ml-64">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">Upload Files</h2>
            <span className="text-sm text-slate-400">→ {getUploadLocationText()}</span>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Auto-tagging Toggle */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">AI Auto-tagging</h3>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTaggingEnabled}
                  onChange={(e) => setAutoTaggingEnabled(e.target.checked)}
                  disabled={isUploading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-slate-600 hover:border-blue-500'
            }`}
          >
            <Upload className={`w-16 h-16 mx-auto mb-6 ${
              dragActive ? 'text-blue-400' : 'text-slate-400'
            }`} />
            <p className="text-white font-medium mb-3 text-lg">
              {dragActive ? 'Drop files here' : 'Drop files here or click to browse'}
            </p>
            <p className="text-slate-400 text-sm mb-6">Support for multiple files up to 10MB each</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200 text-lg"
            >
              Choose Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">
                  Selected Files ({selectedFiles.length})
                </h3>
                <span className="text-slate-400 text-sm">
                  Total: {getTotalSize()}
                </span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{file.name}</p>
                        <p className="text-slate-400 text-xs">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Tags */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Manual Tags (Optional)</h3>
              {autoTaggingEnabled && (
                <span className="text-xs text-slate-400">AI tags will be added automatically</span>
              )}
            </div>
            <TagInput
              tags={manualTags}
              onTagsChange={setManualTags}
              placeholder="Add a manual tag..."
              disabled={isUploading}
            />
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3">Upload Progress</h3>
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div key={upload.fileId} className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {upload.status === 'complete' ? (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        ) : upload.status === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        ) : upload.status === 'tagging' ? (
                          <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        ) : (
                          <Loader className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                        )}
                        <span className="text-white text-sm font-medium truncate">
                          {upload.fileName}
                        </span>
                      </div>
                      <span className="text-slate-400 text-sm flex-shrink-0">{upload.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          upload.status === 'error' ? 'bg-red-500' : 
                          upload.status === 'complete' ? 'bg-green-500' : 
                          upload.status === 'tagging' ? 'bg-blue-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    {upload.status === 'complete' && (
                      <p className="text-green-400 text-xs mt-2">
                        ✓ Upload completed {autoTaggingEnabled ? 'and sent for AI tagging' : 'successfully'}
                      </p>
                    )}
                    {upload.status === 'tagging' && (
                      <p className="text-blue-400 text-xs mt-2">
                        🤖 AI is analyzing and tagging your file...
                      </p>
                    )}
                    {upload.error && (
                      <p className="text-red-400 text-xs mt-2">✗ {upload.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Uploads */}
          {recentUploads.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Recent Uploads ({recentUploads.length})</h3>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto border border-slate-600 rounded-lg p-4 bg-slate-700/20">
                {recentUploads.map((file) => (
                  <div key={file.id} className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <h4 className="text-white font-medium truncate">{file.name}</h4>
                          <span className="text-xs text-slate-500 flex-shrink-0 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatUploadTime(file.uploadTime)}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {file.tags && file.tags.length > 0 ? (
                            file.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded-md"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">No tags</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeRecentUpload(file.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors duration-200 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
          >
            Close
          </button>
          {selectedFiles.length > 0 && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 text-lg"
            >
              {isUploading && <Loader className="w-4 h-4 animate-spin" />}
              <span>
                {isUploading 
                  ? 'Uploading...' 
                  : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
                }
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;