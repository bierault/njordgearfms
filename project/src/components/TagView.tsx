import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
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
  AlertTriangle,
  Loader,
  Info,
  Check
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
  userRole?: 'admin' | 'employee';
}

const TagView: React.FC<TagViewProps> = ({ 
  className = '',
  userRole = 'admin'
}) => {
  const { currentWorkspace } = useWorkspace();
  const { files, updateFile, toggleFavorite, loading, error, refreshFiles } = useFileData();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showEditTag, setShowEditTag] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editTagName, setEditTagName] = useState('');
  const [selectedTagMenu, setSelectedTagMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'recent'>('count');
  const [filterType, setFilterType] = useState<'all' | 'used' | 'unused'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tagList, setTagList] = useState<string[]>([]);
  const [showRenameTag, setShowRenameTag] = useState<string | null>(null);
  const [renameTagValue, setRenameTagValue] = useState('');

  // Check permissions
  const canEditTags = userRole === 'admin';

  // Colors for tag selection
  const tagColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ];

  // Load tags when files change
  useEffect(() => {
    if (files.length > 0) {
      const allTags = getAllTags(files);
      setTagList(allTags);
    }
  }, [files]);

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

  // Normalize tag name (lowercase, trim)
  const normalizeTag = (tag: string): string => {
    return tag.toLowerCase().trim();
  };

  // Get all tags with statistics from files only
  const getTagStats = (): TagStats[] => {
    console.log('Getting tag stats from files:', files.length);
    
    // Get all tags from files in current workspace
    const fileTags = getAllTags(files);
    console.log('File tags found:', fileTags);
    
    const tagStats: TagStats[] = [];

    fileTags.forEach(tag => {
      const normalizedTag = normalizeTag(tag);
      
      // Find files with this tag (case-insensitive)
      const tagFiles = files.filter(file => {
        return file.tags && file.tags.some(fileTag => normalizeTag(fileTag) === normalizedTag);
      });

      tagStats.push({
        tag,
        count: tagFiles.length,
        files: tagFiles,
        color: getTagColor(tag)
      });
    });

    console.log('Tag stats generated:', tagStats);

    // Apply filtering
    let filteredStats = tagStats;
    if (filterType === 'used') {
      filteredStats = tagStats.filter(stat => stat.count > 0);
    } else if (filterType === 'unused') {
      filteredStats = tagStats.filter(stat => stat.count === 0);
    }

    // Apply sorting
    filteredStats.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.tag.localeCompare(b.tag);
        case 'count':
          return b.count - a.count;
        case 'recent':
          const aLatest = Math.max(...a.files.map(f => new Date(f.modifiedDate).getTime()));
          const bLatest = Math.max(...b.files.map(f => new Date(f.modifiedDate).getTime()));
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

  const handleAddTag = async () => {
    if (!canEditTags || !newTagName.trim()) {
      return;
    }

    setIsProcessing(true);
    try {
      // Check if tag already exists
      const normalizedNewTag = normalizeTag(newTagName.trim());
      const allTags = getAllTags(files);
      const existingTag = allTags.find(tag => normalizeTag(tag) === normalizedNewTag);

      if (existingTag) {
        alert(`Tag "${existingTag}" already exists`);
        setIsProcessing(false);
        return;
      }

      // Create a visible file with this tag (not soft-deleted)
      const { data: newFile, error: fileError } = await supabase
        .from('files')
        .insert({
          name: `Tag: ${newTagName.trim()}`,
          original_name: `tag_${Date.now()}.txt`,
          file_path: `tags/${currentWorkspace.id}/${Date.now()}.txt`,
          file_type: 'text/plain',
          file_category: 'document',
          file_size: 0,
          tags: [newTagName.trim()],
          workspace_id: currentWorkspace.id,
          is_favorite: false
        })
        .select()
        .single();

      if (fileError) {
        throw new Error(`Failed to create tag: ${fileError.message}`);
      }

      console.log('Created tag file:', newFile);

      // Add the new tag to the tag list
      setTagList(prev => [...prev, newTagName.trim()]);
      
      // Close the modal and reset form
      setShowAddTagModal(false);
      setNewTagName('');
      
      // Refresh to show the new tag
      await refreshFiles();
      
      // Select the new tag
      setSelectedTag(newTagName.trim());
      
    } catch (error) {
      console.error('Failed to add tag:', error);
      alert(`Failed to add tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenameTag = async (oldTag: string, newTag: string) => {
    if (!canEditTags || !newTag.trim() || normalizeTag(oldTag) === normalizeTag(newTag)) return;

    const normalizedNewTag = normalizeTag(newTag.trim());
    const normalizedOldTag = normalizeTag(oldTag);

    // Check if new tag name already exists
    const allTags = getAllTags(files);
    const existingTag = allTags.find(tag => 
      normalizeTag(tag) === normalizedNewTag && normalizeTag(tag) !== normalizedOldTag
    );

    if (existingTag) {
      // Merge tags instead of renaming
      if (window.confirm(`Tag "${existingTag}" already exists. Do you want to merge "${oldTag}" into "${existingTag}"?`)) {
        await handleMergeTags(oldTag, existingTag);
      }
      return;
    }

    setIsProcessing(true);
    try {
      console.log(`Starting bulk rename: "${oldTag}" → "${newTag.trim()}"`);
      
      // Get all files that contain the old tag
      const filesToUpdate = files.filter(file => 
        file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedOldTag)
      );

      console.log(`Found ${filesToUpdate.length} files to update`);

      if (filesToUpdate.length > 0) {
        // Update each file
        for (const file of filesToUpdate) {
          if (file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedOldTag)) {
            const updatedTags = file.tags.map(tag => 
              normalizeTag(tag) === normalizedOldTag ? newTag.trim() : tag
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

        console.log(`Successfully renamed tag "${oldTag}" to "${newTag.trim()}" in ${filesToUpdate.length} files`);
        markFilesAsUpdated();
      }

      // Update local state
      setShowEditTag(null);
      setEditTagName('');
      setSelectedTagMenu(null);
      
      // Update selected tag if it was the one being renamed
      if (selectedTag && normalizeTag(selectedTag) === normalizedOldTag) {
        setSelectedTag(newTag.trim());
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

  const handleMergeTags = async (sourceTag: string, targetTag: string) => {
    if (!canEditTags) return;
    
    const normalizedSourceTag = normalizeTag(sourceTag);
    const normalizedTargetTag = normalizeTag(targetTag);

    if (normalizedSourceTag === normalizedTargetTag) return;

    setIsProcessing(true);
    try {
      console.log(`Merging tag "${sourceTag}" into "${targetTag}"`);
      
      // Get all files that contain the source tag
      const filesToUpdate = files.filter(file => 
        file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedSourceTag)
      );

      if (filesToUpdate.length > 0) {
        for (const file of filesToUpdate) {
          if (file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedSourceTag)) {
            // Remove source tag and add target tag if not already present
            let updatedTags = file.tags.filter(tag => normalizeTag(tag) !== normalizedSourceTag);
            
            if (!updatedTags.some(tag => normalizeTag(tag) === normalizedTargetTag)) {
              updatedTags.push(targetTag);
            }
            
            const { error: updateError } = await supabase
              .from('files')
              .update({ tags: updatedTags })
              .eq('id', file.id);

            if (updateError) {
              throw new Error(`Failed to update file: ${updateError.message}`);
            }
          }
        }

        markFilesAsUpdated();
      }

      // Update selected tag if needed
      if (selectedTag && normalizeTag(selectedTag) === normalizedSourceTag) {
        setSelectedTag(targetTag);
      }

      await refreshFiles();
      
    } catch (error) {
      console.error('Failed to merge tags:', error);
      alert(`Failed to merge tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTag = async (tagToDelete: string) => {
    if (!canEditTags) return;
    
    const normalizedTagToDelete = normalizeTag(tagToDelete);
    
    setIsProcessing(true);
    try {
      console.log(`Starting bulk delete for tag: "${tagToDelete}"`);
      
      // Get all files that contain the tag to delete
      const filesToUpdate = files.filter(file => 
        file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedTagToDelete)
      );

      console.log(`Found ${filesToUpdate.length} files to update`);

      if (filesToUpdate.length > 0) {
        // Update each file
        for (const file of filesToUpdate) {
          if (file.tags && file.tags.some(tag => normalizeTag(tag) === normalizedTagToDelete)) {
            const updatedTags = file.tags.filter(tag => normalizeTag(tag) !== normalizedTagToDelete);
            
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

        console.log(`Successfully deleted tag "${tagToDelete}" from ${filesToUpdate.length} files`);
        markFilesAsUpdated();
      }

      setSelectedTagMenu(null);
      setShowDeleteConfirm(null);
      
      // Clear selected tag if it was the one being deleted
      if (selectedTag && normalizeTag(selectedTag) === normalizedTagToDelete) {
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

  const tagStats = getTagStats();
  const selectedTagFiles = selectedTag ? tagStats.find(stat => normalizeTag(stat.tag) === normalizeTag(selectedTag))?.files || [] : [];

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
      {/* Employee Permission Notice */}
      {userRole === 'employee' && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-blue-400 font-medium">Employee View Mode</p>
              <p className="text-blue-300/80 text-sm">You can view tags and tagged files, but only administrators can edit tags.</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        </select>

        {/* Add Tag Button - Admin Only */}
        {canEditTags && (
          <button
            onClick={() => setShowAddTagModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tag</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Tags List */}
        <div className="w-1/3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4">
              Tags ({tagStats.length})
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tagStats.map((stat) => (
                <div
                  key={stat.tag}
                  className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                    selectedTag && normalizeTag(selectedTag) === normalizeTag(stat.tag)
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  onClick={() => setSelectedTag(selectedTag && normalizeTag(selectedTag) === normalizeTag(stat.tag) ? null : stat.tag)}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stat.color }}
                    />
                    {showRenameTag === stat.tag ? (
                      <div className="flex items-center space-x-2 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={renameTagValue}
                          onChange={(e) => setRenameTagValue(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameTag(stat.tag, renameTagValue);
                            } else if (e.key === 'Escape') {
                              setShowRenameTag(null);
                              setRenameTagValue('');
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm bg-slate-600 border border-slate-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameTag(stat.tag, renameTagValue)}
                          disabled={!renameTagValue.trim() || isProcessing}
                          className="p-1 rounded text-green-400 hover:text-green-300 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setShowRenameTag(null);
                            setRenameTagValue('');
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium truncate">{stat.tag}</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      selectedTag && normalizeTag(selectedTag) === normalizeTag(stat.tag)
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-600 text-slate-300'
                    }`}>
                      {stat.count}
                    </span>
                  </div>
                  
                  {/* Tag Actions - Only for admins */}
                  {canEditTags && showRenameTag !== stat.tag && (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRenameTag(stat.tag);
                          setRenameTagValue(stat.tag);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                        title="Rename tag"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(stat.tag);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors duration-200"
                        title="Delete tag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {tagStats.length === 0 && (
                <div className="text-center py-8">
                  <Tag className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No tags found</p>
                  <p className="text-slate-600 text-xs">
                    Tags will appear as you add them to files
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
                    onToggleFavorite={toggleFavorite}
                    onUpdate={updateFile}
                    userRole={userRole}
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
                      <p className="text-2xl font-bold text-white">{tagStats.length}</p>
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
                        {tagStats.length > 0 ? tagStats[0].tag : 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Tag Modal - Admin Only */}
      {showAddTagModal && canEditTags && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Add New Tag</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter tag name..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    <Palette className="w-4 h-4 inline mr-1" />
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tagColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                          newTagColor === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleAddTag}
                  disabled={!newTagName.trim() || isProcessing}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    {isProcessing ? 'Creating...' : 'Create Tag'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowAddTagModal(false);
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

      {/* Delete Tag Confirmation Modal */}
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
                This will remove it from all files.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleDeleteTag(showDeleteConfirm)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    "Delete Tag"
                  )}
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
    </div>
  );
};

export default TagView;