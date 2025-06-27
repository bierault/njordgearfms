import React, { useState } from 'react';
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
  Star
} from 'lucide-react';
import { FileItem } from './FileCard';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface BatchActionBarProps {
  selectedFiles: FileItem[];
  onClearSelection: () => void;
  onBatchMove: (fileIds: string[], projectId: string | null, folderId: string | null) => Promise<void>;
  onBatchAddTags: (fileIds: string[], tags: string[]) => Promise<void>;
  onBatchRemoveTags: (fileIds: string[], tags: string[]) => Promise<void>;
  onBatchToggleFavorite?: (fileIds: string[]) => Promise<void>;
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
  userRole = 'admin',
  userProjectAccess = [],
  className = ''
}) => {
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagAction, setTagAction] = useState<'add' | 'remove'>('add');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string>('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const { currentWorkspace } = useWorkspace();

  // Load all projects and folders when move modal is opened
  React.useEffect(() => {
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
  const canMove = userRole === 'admin';
  const canEditTags = userRole === 'admin';

  // Filter projects based on user access
  const accessibleProjects = userRole === 'admin' 
    ? allProjects 
    : allProjects.filter(p => userProjectAccess?.includes(p.id));

  const handleBatchFavorite = async () => {
    if (!onBatchToggleFavorite) return;

    setIsProcessing(true);
    setProcessingAction('Updating favorites...');
    
    try {
      const fileIds = selectedFiles.map(f => f.id);
      await onBatchToggleFavorite(fileIds);
      onClearSelection();
    } catch (error) {
      console.error('Batch favorite failed:', error);
      alert('Failed to update favorites. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleMoveFiles = async (projectId: string | null, folderId: string | null) => {
    if (!canMove) return;

    setIsProcessing(true);
    setProcessingAction('Moving files...');
    
    try {
      const fileIds = selectedFiles.map(f => f.id);
      await onBatchMove(fileIds, projectId, folderId);
      setShowMoveModal(false);
      onClearSelection();
    } catch (error) {
      console.error('Batch move failed:', error);
      alert('Failed to move some files. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleTagAction = async () => {
    if (!canEditTags || newTags.length === 0) return;

    setIsProcessing(true);
    setProcessingAction(tagAction === 'add' ? 'Adding tags...' : 'Removing tags...');
    
    try {
      const fileIds = selectedFiles.map(f => f.id);
      
      if (tagAction === 'add') {
        await onBatchAddTags(fileIds, newTags);
      } else {
        await onBatchRemoveTags(fileIds, newTags);
      }
      
      setShowTagModal(false);
      setNewTags([]);
      setNewTagInput('');
      onClearSelection();
    } catch (error) {
      console.error('Batch tag operation failed:', error);
      alert('Failed to update tags. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const addNewTag = () => {
    if (newTagInput.trim() && !newTags.includes(newTagInput.trim())) {
      setNewTags([...newTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewTags(newTags.filter(tag => tag !== tagToRemove));
  };

  const getAllSelectedTags = () => {
    const tagSet = new Set<string>();
    selectedFiles.forEach(file => {
      if (file.tags) {
        file.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
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

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBatchFavorite}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Star className="w-4 h-4" />
              <span>Star</span>
            </button>

            {canMove ? (
              <button
                onClick={() => setShowMoveModal(true)}
                disabled={isProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
              >
                <Move className="w-4 h-4" />
                <span>Move</span>
              </button>
            ) : (
              <button
                disabled={true}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-700 opacity-50 cursor-not-allowed text-white rounded-lg font-medium"
              >
                <Move className="w-4 h-4" />
                <span>Move</span>
              </button>
            )}

            {canEditTags ? (
              <button
                onClick={() => {
                  setTagAction('add');
                  setShowTagModal(true);
                }}
                disabled={isProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
              >
                <Tag className="w-4 h-4" />
                <span>Edit Tags</span>
              </button>
            ) : (
              <button
                disabled={true}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 opacity-50 cursor-not-allowed text-white rounded-lg font-medium"
              >
                <Tag className="w-4 h-4" />
                <span>Edit Tags</span>
              </button>
            )}
          </div>

          {/* Permission Notice for Employees */}
          {userRole === 'employee' && (
            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-xs">
                Limited permissions: You can only star files. Contact an admin for other actions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Move Modal */}
      {showMoveModal && canMove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-96 overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Move Files</h3>
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                Move {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} to:
              </p>
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
                    onClick={() => handleMoveFiles(null, null)}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200"
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
                          onClick={() => handleMoveFiles(project.id, null)}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200"
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
                            onClick={() => handleMoveFiles(project.id, folder.id)}
                            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 ml-4"
                          >
                            <Folder className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}

                  {accessibleProjects.length === 0 && !loadingProjects && (
                    <div className="text-center py-8">
                      <Folder className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No accessible projects</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {showTagModal && canEditTags && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Edit Tags</h3>
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setNewTags([]);
                    setNewTagInput('');
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                Manage tags for {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Action Selector */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setTagAction('add')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    tagAction === 'add'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Add Tags
                </button>
                <button
                  onClick={() => setTagAction('remove')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    tagAction === 'remove'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Remove Tags
                </button>
              </div>

              {/* Selected Tags */}
              {newTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Selected Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {newTags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center px-3 py-1 text-sm rounded-full ${
                          tagAction === 'add' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-2 hover:text-opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Tag */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  {tagAction === 'add' ? 'Add Tag' : 'Select Tag to Remove'}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewTag()}
                    placeholder={tagAction === 'add' ? 'Enter tag name...' : 'Enter tag to remove...'}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={addNewTag}
                    disabled={!newTagInput.trim()}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors duration-200"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Existing Tags (for remove action) */}
              {tagAction === 'remove' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Common Tags in Selected Files
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {getAllSelectedTags().map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (!newTags.includes(tag)) {
                            setNewTags([...newTags, tag]);
                          }
                        }}
                        className={`px-3 py-1 text-sm rounded-full transition-colors duration-200 ${
                          newTags.includes(tag)
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleTagAction}
                  disabled={newTags.length === 0}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed text-white ${
                    tagAction === 'add' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {tagAction === 'add' ? 'Add Tags' : 'Remove Tags'}
                </button>
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setNewTags([]);
                    setNewTagInput('');
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BatchActionBar;