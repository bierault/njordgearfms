import React, { useState, useEffect } from 'react';
import { 
  X, 
  Move, 
  Tag, 
  Plus, 
  Minus,
  Folder,
  Home,
  CheckCircle,
  AlertCircle,
  Loader,
  Star,
  Edit3,
  Download,
  Share2
} from 'lucide-react';
import { FileItem } from './FileCard';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';

interface BatchActionBarProps {
  selectedFiles: FileItem[];
  onClearSelection: () => void;
  onBatchMove?: (fileIds: string[], projectId: string | null, folderId: string | null) => Promise<void>;
  onBatchAddTags?: (fileIds: string[], tags: string[]) => Promise<void>;
  onBatchRemoveTags?: (fileIds: string[], tags: string[]) => Promise<void>;
  onBatchToggleFavorite?: (fileIds: string[]) => Promise<void>;
  onBatchDownload?: (fileIds: string[]) => Promise<void>;
  onBatchShare?: (fileIds: string[]) => Promise<void>;
  userRole?: 'admin' | 'employee';
  userProjectAccess?: string[];
  className?: string;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedFiles,
  onClearSelection,
  onBatchMove,
  onBatchAddTags,
  onBatchRemoveTags,
  onBatchToggleFavorite,
  onBatchDownload,
  onBatchShare,
  userRole = 'admin',
  userProjectAccess = [],
  className = ''
}) => {
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string>('');
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showMoveSuccess, setShowMoveSuccess] = useState(false);
  const [showDownloadSuccess, setShowDownloadSuccess] = useState(false);

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

  // Filter projects based on user access
  const accessibleProjects = userRole === 'admin' 
    ? allProjects 
    : allProjects.filter(p => userProjectAccess?.includes(p.id));

  const handleBatchMove = async (projectId: string | null, folderId: string | null) => {
    if (!onBatchMove) return;

    setIsProcessing(true);
    setProcessingAction('Moving files...');
    
    try {
      const fileIds = selectedFiles.map(f => f.id);
      await onBatchMove(fileIds, projectId, folderId);
      
      setShowMoveSuccess(true);
      setTimeout(() => {
        setShowMoveSuccess(false);
        setShowMoveModal(false);
        onClearSelection();
      }, 2000);
    } catch (error) {
      console.error('Batch move failed:', error);
      alert('Failed to move files. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleBatchDownload = async () => {
    setIsProcessing(true);
    setProcessingAction('Preparing downloads...');
    
    try {
      // Download each file individually
      for (const file of selectedFiles) {
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
          
          // Small delay between downloads to prevent browser issues
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
        }
      }
      
      setShowDownloadSuccess(true);
      setTimeout(() => {
        setShowDownloadSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Batch download failed:', error);
      alert('Failed to download files. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getTotalSize = () => {
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.fileSize, 0);
    return formatFileSize(totalBytes);
  };

  if (selectedFiles.length === 0) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-96">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </h3>
                <p className="text-slate-400 text-sm">Total size: {getTotalSize()}</p>
              </div>
            </div>
            <button
              onClick={onClearSelection}
              disabled={isProcessing}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <Loader className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="text-blue-400 font-medium">{processingAction}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {showMoveSuccess && (
            <div className="mb-4 p-3 bg-green-600/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Files moved successfully!</span>
              </div>
            </div>
          )}

          {/* Download Success Message */}
          {showDownloadSuccess && (
            <div className="mb-4 p-3 bg-green-600/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Files downloaded successfully!</span>
              </div>
            </div>
          )}

          {/* Action Buttons - Limited to Move and Download */}
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Move */}
            <button
              onClick={() => setShowMoveModal(true)}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Move className="w-4 h-4" />
              <span>Move</span>
            </button>

            {/* Download */}
            <button
              onClick={handleBatchDownload}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md max-h-96 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Move Files</h3>
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="text-slate-400 hover:text-white transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-sm mt-1">Choose destination for {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}</p>
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
                    onClick={() => handleBatchMove(null, null)}
                    disabled={isProcessing}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    <Home className="w-4 h-4" />
                    <span>Workspace Root</span>
                  </button>

                  {/* Projects and Folders */}
                  {accessibleProjects.map((project) => {
                    const projectFolders = allFolders.filter(f => f.project_id === project.id);
                    
                    return (
                      <div key={project.id} className="space-y-1">
                        {/* Project Root */}
                        <button
                          onClick={() => handleBatchMove(project.id, null)}
                          disabled={isProcessing}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate">{project.name}</span>
                        </button>

                        {/* Project Folders */}
                        {projectFolders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => handleBatchMove(project.id, folder.id)}
                            disabled={isProcessing}
                            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ml-4 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                          >
                            <Folder className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{folder.name}</span>
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
      )}
    </>
  );
};

export default BatchActionBar;