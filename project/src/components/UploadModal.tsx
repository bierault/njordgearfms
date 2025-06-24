import React, { useState, useRef } from 'react';
import { X, Upload, File, Tag, Plus, CheckCircle, AlertCircle, Loader, Zap, Settings, Edit3, Save, Clock } from 'lucide-react';
import { useFileUpload } from '../hooks/useFileUpload';
import { FileRecord } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (uploadedFiles: any[]) => void;
}

interface RecentUpload extends FileRecord {
  uploadTime: string;
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUploadComplete
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'recent'>('upload');
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newEditTag, setNewEditTag] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, isUploading, uploadFiles } = useFileUpload();
  const { currentProject, currentFolder } = useProject();

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

  const addTag = () => {
    if (newTag.trim() && !manualTags.includes(newTag.trim())) {
      setManualTags([...manualTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setManualTags(manualTags.filter(tag => tag !== tagToRemove));
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(files => files.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      console.log('Starting upload process with auto-tagging:', autoTaggingEnabled);
      console.log('Manual tags:', manualTags);
      console.log('Upload location:', {
        project: currentProject?.name,
        folder: currentFolder?.name
      });
      
      // Upload files with only manual tags
      const uploadedFiles = await uploadFiles(selectedFiles, manualTags, autoTaggingEnabled);
      
      console.log('Upload completed:', uploadedFiles);
      
      // Add to recent uploads with timestamp
      if (uploadedFiles && uploadedFiles.length > 0) {
        const newRecentUploads = uploadedFiles.map(file => ({
          ...file,
          uploadTime: new Date().toISOString()
        }));
        setRecentUploads(prev => [...newRecentUploads, ...prev].slice(0, 20)); // Keep last 20 uploads
        
        // Switch to recent tab to show uploaded files
        setActiveTab('recent');
        
        if (onUploadComplete) {
          onUploadComplete(uploadedFiles);
        }
      }
      
      // Reset form
      setSelectedFiles([]);
      setManualTags([]);
      
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

  const startEditingFile = (file: RecentUpload) => {
    setEditingFile(file.id);
    setEditName(file.name);
    setEditTags(file.tags || []);
    setNewEditTag('');
  };

  const saveFileEdits = async () => {
    if (!editingFile) return;
    
    try {
      const { supabase } = await import('../lib/supabase');
      
      const { error } = await supabase
        .from('files')
        .update({
          name: editName.trim(),
          tags: editTags
        })
        .eq('id', editingFile);

      if (error) throw error;

      // Update local state
      setRecentUploads(prev => prev.map(file => 
        file.id === editingFile 
          ? { ...file, name: editName.trim(), tags: editTags }
          : file
      ));

      setEditingFile(null);
    } catch (error) {
      console.error('Failed to update file:', error);
      alert('Failed to update file. Please try again.');
    }
  };

  const addEditTag = () => {
    if (newEditTag.trim() && !editTags.includes(newEditTag.trim())) {
      setEditTags([...editTags, newEditTag.trim()]);
      setNewEditTag('');
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const getUploadLocationText = () => {
    if (currentProject) {
      if (currentFolder) {
        return `${currentProject.name} > ${currentFolder.name}`;
      }
      return `${currentProject.name} (Root)`;
    }
    return 'Workspace Root';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">File Upload</h2>
            {autoTaggingEnabled && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">AI Auto-tagging</span>
              </div>
            )}
            <div className="text-sm text-slate-400">
              → {getUploadLocationText()}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'upload'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload Files</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'recent'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Recent Uploads ({recentUploads.length})</span>
            </div>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {activeTab === 'upload' ? (
            <>
              {/* Auto-tagging Toggle */}
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">AI Auto-tagging</h3>
                      <p className="text-slate-400 text-sm">Automatically analyze and tag your files using AI</p>
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
                
                {autoTaggingEnabled && (
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-400 font-medium mb-1">Auto-tagging enabled</p>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          Files will be sent to n8n with public Supabase URLs for AI analysis. 
                          The system will analyze file content and automatically add relevant tags.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center space-x-2 mt-3 text-slate-400 hover:text-white transition-colors duration-200"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Advanced Settings</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-3 bg-slate-800 border border-slate-600 rounded-lg">
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400">
                        <p className="font-medium mb-2">Auto-tagging Process:</p>
                        <ul className="space-y-1 text-slate-500">
                          <li>• Public Supabase URLs sent to n8n webhook</li>
                          <li>• AI analyzes file content and visual elements</li>
                          <li>• Relevant tags automatically added to database</li>
                          <li>• Optimized for speed with error handling</li>
                          <li>• Upload succeeds even if tagging fails</li>
                        </ul>
                      </div>
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-600">
                        <p>Webhook: https://njord-gear.app.n8n.cloud/webhook/d2855857-3e7b-4465-b627-89ed188f2151</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Location Info */}
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Upload Destination</h3>
                    <p className="text-slate-400 text-sm">{getUploadLocationText()}</p>
                  </div>
                </div>
              </div>

              {/* File Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-slate-600 hover:border-blue-500'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${
                  dragActive ? 'text-blue-400' : 'text-slate-400'
                }`} />
                <p className="text-white font-medium mb-2">
                  {dragActive ? 'Drop files here' : 'Drop files here or click to browse'}
                </p>
                <p className="text-slate-400 text-sm mb-4">Support for multiple files up to 10MB each</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
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
                <div className="flex flex-wrap gap-2 mb-3">
                  {manualTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        disabled={isUploading}
                        className="ml-2 hover:text-blue-200 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add a manual tag..."
                    disabled={isUploading}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
                  />
                  <button
                    onClick={addTag}
                    disabled={isUploading || !newTag.trim()}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
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
            </>
          ) : (
            /* Recent Uploads Tab */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Recent Uploads</h3>
                <span className="text-slate-400 text-sm">{recentUploads.length} files</span>
              </div>

              {recentUploads.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No recent uploads</h3>
                  <p className="text-slate-400">Files you upload will appear here for quick editing.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentUploads.map((file) => (
                    <div key={file.id} className="p-4 bg-slate-700 rounded-lg">
                      {editingFile === file.id ? (
                        /* Edit Mode */
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              File Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              Tags
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {editTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded-full"
                                >
                                  {tag}
                                  <button
                                    onClick={() => removeEditTag(tag)}
                                    className="ml-1 hover:text-blue-200"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                value={newEditTag}
                                onChange={(e) => setNewEditTag(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addEditTag()}
                                placeholder="Add tag..."
                                className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              />
                              <button
                                onClick={addEditTag}
                                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors duration-200"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={saveFileEdits}
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                            >
                              <Save className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingFile(null)}
                              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
                              <h4 className="text-white font-medium truncate">{file.name}</h4>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {formatUploadTime(file.uploadTime)}
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
                            onClick={() => startEditingFile(file)}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200 flex-shrink-0"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'upload' && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Cancel'}
            </button>
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
            >
              {isUploading && <Loader className="w-4 h-4 animate-spin" />}
              <span>
                {isUploading 
                  ? 'Uploading...' 
                  : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
                }
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadModal;