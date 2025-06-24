import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Search, 
  Plus, 
  X, 
  Edit3, 
  Trash2, 
  FileText, 
  Users, 
  TrendingUp,
  Filter,
  MoreVertical,
  Hash,
  Palette,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useFileData } from '../hooks/useFileData';
import { getAllTags } from '../hooks/useFileSearch';
import FileCard, { FileItem } from './FileCard';
import TagChip from './TagChip';
import { supabase } from '../lib/supabase';
import { markFilesAsUpdated } from '../contexts/WorkspaceContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface TagStats {
  tag: string;
  count: number;
  files: FileItem[];
  color?: string;
}

interface TagViewProps {
  className?: string;
}

const TagView: React.FC<TagViewProps> = ({ className = '' }) => {
  const { currentWorkspace } = useWorkspace();
  const { files, updateFile, removeFile, toggleFavorite, loading, error, refreshFiles } = useFileData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [showEditTag, setShowEditTag] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [editTagName, setEditTagName] = useState('');
  const [selectedTagMenu, setSelectedTagMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'recent'>('count');
  const [filterType, setFilterType] = useState<'all' | 'used' | 'unused'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Don't render if workspace is not available
  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-yellow-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Workspace Selected</h3>
          <p className="text-slate-400">Please select a workspace to manage tags.</p>
        </div>
      </div>
    );
  }

  // Load all tags from workspace when component mounts or files change
  useEffect(() => {
    const loadAllTags = async () => {
      try {
        // Get all unique tags from files in the current workspace
        const { data: tagData, error: tagError } = await supabase
          .from('files')
          .select('tags')
          .eq('workspace_id', currentWorkspace.id)
          .is('deleted_at', null);

        if (tagError) {
          console.error('Error loading tags:', tagError);
          return;
        }

        // Extract unique tags
        const uniqueTags = new Set<string>();
        tagData?.forEach(file => {
          if (file.tags && Array.isArray(file.tags)) {
            file.tags.forEach(tag => uniqueTags.add(tag));
          }
        });

        setAllTags(Array.from(uniqueTags).sort());
      } catch (error) {
        console.error('Error loading all tags:', error);
      }
    };

    loadAllTags();
  }, [currentWorkspace, files]);

  // Get all tags with statistics
  const getTagStats = (): TagStats[] => {
    const tagStats: TagStats[] = [];

    // Include all tags (even those with 0 files)
    allTags.forEach(tag => {
      const tagFiles = files.filter(file => {
        return file.tags && file.tags.includes(tag);
      });

      tagStats.push({
        tag,
        count: tagFiles.length,
        files: tagFiles,
        color: getTagColor(tag)
      });
    });

    // Apply filtering
    let filteredStats = tagStats;
    if (filterType === 'used') {
      filteredStats = tagStats.filter(stat => stat.count > 0);
    } else if (filterType === 'unused') {
      filteredStats = tagStats.filter(stat => stat.count === 0);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredStats = filteredStats.filter(stat => 
        stat.tag.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filteredStats.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.tag.localeCompare(b.tag);
        case 'count':
          return b.count - a.count;
        case 'recent':
          const aLatest = a.files.length > 0 ? Math.max(...a.files.map(f => new Date(f.modifiedDate).getTime())) : 0;
          const bLatest = b.files.length > 0 ? Math.max(...b.files.map(f => new Date(f.modifiedDate).getTime())) : 0;
          return bLatest - aLatest;
        default:
          return 0;
      }
    });

    return filteredStats;
  };

  const getTagColor = (tag: string): string => {
    // Generate consistent color based on tag name
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
      '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
    ];
    
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsProcessing(true);
    try {
      const tagName = newTagName.trim();
      
      // Check if tag already exists
      if (allTags.includes(tagName)) {
        alert('Tag already exists');
        return;
      }

      // Add the tag to our local state immediately
      setAllTags(prev => [...prev, tagName].sort());
      
      console.log('Created new tag:', tagName);
      setNewTagName('');
      setShowCreateTag(false);
      
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenameTag = async (oldTag: string, newTag: string) => {
    if (!newTag.trim() || oldTag === newTag) return;

    setIsProcessing(true);
    try {
      console.log(`Starting bulk rename: "${oldTag}" → "${newTag}"`);
      
      // Get all files that contain the old tag using array contains operator
      const { data: filesToUpdate, error: fetchError } = await supabase
        .from('files')
        .select('id, tags')
        .eq('workspace_id', currentWorkspace.id)
        .filter('tags', 'cs', `{${oldTag}}`); // Use contains operator for arrays

      if (fetchError) {
        console.error('Error fetching files for tag rename:', fetchError);
        throw new Error(`Failed to fetch files: ${fetchError.message}`);
      }

      console.log(`Found ${filesToUpdate?.length || 0} files to update`);

      if (filesToUpdate && filesToUpdate.length > 0) {
        // Process files in batches for better performance
        const batchSize = 20;
        
        for (let i = 0; i < filesToUpdate.length; i += batchSize) {
          const batch = filesToUpdate.slice(i, i + batchSize);
          
          // Update each file individually to ensure proper array handling
          for (const file of batch) {
            if (file.tags && file.tags.includes(oldTag)) {
              const updatedTags = file.tags.map((tag: string) => 
                tag === oldTag ? newTag : tag
              );
              
              const { error: updateError } = await supabase
                .from('files')
                .update({ tags: updatedTags })
                .eq('id', file.id);

              if (updateError) {
                console.error(`Error updating file ${file.id}:`, updateError);
                throw new Error(`Failed to update file: ${updateError.message}`);
              }
            }
          }
          
          // Small delay between batches to avoid overwhelming the database
          if (i + batchSize < filesToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        console.log(`Successfully renamed tag "${oldTag}" to "${newTag}" in ${filesToUpdate.length} files`);
        markFilesAsUpdated();
      }

      // Update local tags list
      setAllTags(prev => prev.map(tag => tag === oldTag ? newTag : tag).sort());

      // Update local state
      setShowEditTag(null);
      setEditTagName('');
      setSelectedTagMenu(null);
      
      // Update selected tag if it was the one being renamed
      if (selectedTag === oldTag) {
        setSelectedTag(newTag);
      }

      // Refresh files to get updated data
      await refreshFiles();
      
    } catch (error) {
      console.error('Failed to rename tag:', error);
      alert(`Failed to rename tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTag = async (tagToDelete: string) => {
    setIsProcessing(true);
    try {
      console.log(`Starting bulk delete for tag: "${tagToDelete}"`);
      
      // Get all files that contain the tag to delete using array contains operator
      const { data: filesToUpdate, error: fetchError } = await supabase
        .from('files')
        .select('id, tags')
        .eq('workspace_id', currentWorkspace.id)
        .filter('tags', 'cs', `{${tagToDelete}}`); // Use contains operator for arrays

      if (fetchError) {
        console.error('Error fetching files for tag deletion:', fetchError);
        throw new Error(`Failed to fetch files: ${fetchError.message}`);
      }

      console.log(`Found ${filesToUpdate?.length || 0} files to update`);

      if (filesToUpdate && filesToUpdate.length > 0) {
        // Process files in batches for better performance
        const batchSize = 20;
        
        for (let i = 0; i < filesToUpdate.length; i += batchSize) {
          const batch = filesToUpdate.slice(i, i + batchSize);
          
          // Update each file individually to ensure proper array handling
          for (const file of batch) {
            if (file.tags && file.tags.includes(tagToDelete)) {
              const updatedTags = file.tags.filter((tag: string) => tag !== tagToDelete);
              
              const { error: updateError } = await supabase
                .from('files')
                .update({ tags: updatedTags })
                .eq('id', file.id);

              if (updateError) {
                console.error(`Error updating file ${file.id}:`, updateError);
                throw new Error(`Failed to update file: ${updateError.message}`);
              }
            }
          }
          
          // Small delay between batches to avoid overwhelming the database
          if (i + batchSize < filesToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        console.log(`Successfully deleted tag "${tagToDelete}" from ${filesToUpdate.length} files`);
        markFilesAsUpdated();
      }

      // Remove from local tags list
      setAllTags(prev => prev.filter(tag => tag !== tagToDelete));

      setSelectedTagMenu(null);
      setShowDeleteConfirm(null);
      
      // Clear selected tag if it was the one being deleted
      if (selectedTag === tagToDelete) {
        setSelectedTag(null);
      }

      // Refresh files to get updated data
      await refreshFiles();
      
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkTagOperation = async (operation: 'add' | 'remove', tag: string, fileIds: string[]) => {
    try {
      for (const fileId of fileIds) {
        const file = files.find(f => f.id === fileId);
        if (!file) continue;

        let updatedTags = [...(file.tags || [])];
        
        if (operation === 'add' && !updatedTags.includes(tag)) {
          updatedTags.push(tag);
        } else if (operation === 'remove') {
          updatedTags = updatedTags.filter(t => t !== tag);
        }

        await updateFile(fileId, { tags: updatedTags });
      }
      
      markFilesAsUpdated();
    } catch (error) {
      console.error('Failed to perform bulk tag operation:', error);
    }
  };

  const tagStats = getTagStats();
  const selectedTagFiles = selectedTag ? tagStats.find(stat => stat.tag === selectedTag)?.files || [] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading tags...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Failed to load tags</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Tag Management</h1>
          <p className="text-slate-400">
            Organize and manage tags across all your files in <span className="text-blue-400">{currentWorkspace.name}</span>. {tagStats.length} tags found.
          </p>
        </div>
        <button
          onClick={() => setShowCreateTag(true)}
          disabled={isProcessing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Create Tag</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'count' | 'recent')}
          className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="count">Sort by Usage</option>
          <option value="name">Sort by Name</option>
          <option value="recent">Sort by Recent</option>
        </select>

        {/* Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'used' | 'unused')}
          className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Tags</option>
          <option value="used">Used Tags</option>
          <option value="unused">Unused Tags</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Tags List */}
        <div className="w-1/3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-4">Tags ({tagStats.length})</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tagStats.map((stat) => (
                <div
                  key={stat.tag}
                  className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                    selectedTag === stat.tag
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  onClick={() => setSelectedTag(selectedTag === stat.tag ? null : stat.tag)}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="text-sm font-medium truncate">{stat.tag}</span>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      selectedTag === stat.tag
                        ? 'bg-blue-500 text-white'
                        : stat.count === 0
                        ? 'bg-slate-500 text-slate-400'
                        : 'bg-slate-600 text-slate-300'
                    }`}>
                      {stat.count}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTagMenu(selectedTagMenu === stat.tag ? null : stat.tag);
                      }}
                      disabled={isProcessing}
                      className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Tag Menu */}
                    {selectedTagMenu === stat.tag && (
                      <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 w-48 z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEditTag(stat.tag);
                            setEditTagName(stat.tag);
                            setSelectedTagMenu(null);
                          }}
                          disabled={isProcessing}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Rename Tag</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(stat.tag);
                            setSelectedTagMenu(null);
                          }}
                          disabled={isProcessing}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Tag</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {tagStats.length === 0 && (
                <div className="text-center py-8">
                  <Tag className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No tags found</p>
                  <p className="text-slate-600 text-xs">
                    {searchQuery ? 'Try a different search term' : 'Create tags to organize your files'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Files with Selected Tag */}
        <div className="flex-1">
          {selectedTag ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  Files tagged with "{selectedTag}" ({selectedTagFiles.length})
                </h3>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedTagFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onDelete={removeFile}
                    onToggleFavorite={toggleFavorite}
                    onUpdate={updateFile}
                  />
                ))}
              </div>

              {selectedTagFiles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No files with this tag</h3>
                  <p className="text-slate-400">Files tagged with "{selectedTag}" will appear here.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
              <div className="text-center">
                <Hash className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Select a tag to view files</h3>
                <p className="text-slate-400">
                  Click on any tag from the list to see all files that have been tagged with it.
                </p>
              </div>

              {/* Tag Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Tags</p>
                      <p className="text-2xl font-bold text-white">{allTags.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Tagged Files</p>
                      <p className="text-2xl font-bold text-white">
                        {files.filter(f => f.tags && f.tags.length > 0).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Most Used</p>
                      <p className="text-lg font-bold text-white truncate">
                        {tagStats.length > 0 && tagStats[0].count > 0 ? tagStats[0].tag : 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Tag Modal */}
      {showCreateTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Create New Tag</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
                    placeholder="Enter tag name..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="text-xs text-slate-500">
                  <p>Create a new tag that can be assigned to files. The tag will start with 0 files attached.</p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isProcessing}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isProcessing ? 'Creating...' : 'Create Tag'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCreateTag(false);
                    setNewTagName('');
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Rename Tag</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    New Tag Name
                  </label>
                  <input
                    type="text"
                    value={editTagName}
                    onChange={(e) => setEditTagName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && showEditTag && handleRenameTag(showEditTag, editTagName)}
                    placeholder="Enter new tag name..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    if (showEditTag) {
                      handleRenameTag(showEditTag, editTagName);
                    }
                  }}
                  disabled={!editTagName.trim() || isProcessing}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isProcessing ? 'Renaming...' : 'Rename Tag'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowEditTag(null);
                    setEditTagName('');
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Tag</h3>
                  <p className="text-slate-400 text-sm">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-slate-300 mb-6">
                Are you sure you want to delete the tag <span className="font-medium text-white">"{showDeleteConfirm}"</span>? 
                This will remove it from all files that currently have this tag.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleDeleteTag(showDeleteConfirm)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isProcessing ? 'Deleting...' : 'Delete Tag'}</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close tag menu */}
      {selectedTagMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedTagMenu(null)}
        />
      )}
    </div>
  );
};

export default TagView;