import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import FileGrid from './components/FileGrid';
import FilePreviewModal from './components/FilePreviewModal';
import SharePage from './components/SharePage';
import ProjectView from './components/ProjectView';
import ProjectGrid from './components/ProjectGrid';
import TagView from './components/TagView';
import { WorkspaceProvider, useWorkspace, shouldRefreshFiles, clearFilesUpdateFlag } from './contexts/WorkspaceContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { useFileData } from './hooks/useFileData';
import { useFileSearch, SearchFilters } from './hooks/useFileSearch';
import { useFileFilters } from './hooks/useFileFilters';
import { ViewMode, SortOption, SortDirection, FilterType } from './components/FilterBar';
import { FileItem } from './components/FileCard';

function AppContent() {
  // Check if we're on a share page first (this doesn't require workspace)
  const isSharePage = window.location.pathname.startsWith('/share/');
  const shareFileId = isSharePage ? window.location.pathname.split('/share/')[1] : null;

  if (isSharePage && shareFileId) {
    return <SharePage fileId={shareFileId} />;
  }

  // For non-share pages, we need workspace context
  return <AppWithWorkspace />;
}

function AppWithWorkspace() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  
  // Show loading state while workspace is loading
  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Show error state if workspace failed to load
  if (workspaceError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Workspace Error</h3>
          <p className="text-slate-400 mb-6">{workspaceError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show no workspace state if no workspace is available
  if (!currentWorkspace) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-yellow-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Workspace Available</h3>
          <p className="text-slate-400 mb-6">Please create or select a workspace to continue.</p>
        </div>
      </div>
    );
  }

  // Only render main content when workspace is fully loaded
  return <AppContentWithWorkspace currentWorkspace={currentWorkspace} />;
}

function AppContentWithWorkspace({ currentWorkspace }: { currentWorkspace: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showProjectView, setShowProjectView] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags: []
  });

  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Get files for current workspace context
  const { 
    files, 
    loading, 
    error, 
    currentPage,
    totalPages,
    totalCount,
    hasNextPage,
    hasPrevPage,
    removeFile, 
    toggleFavorite, 
    updateFile, 
    addFiles, 
    refreshFiles,
    nextPage,
    prevPage,
    goToPage
  } = useFileData(false); // Use workspace context, not project context

  // Apply view filters and search filters to files
  const getFilteredFiles = () => {
    let viewFilteredFiles = [...files];

    // Apply view-specific filters
    switch (activeView) {
      case 'all-files':
        // Show all files (no additional filtering)
        break;
      case 'favorites':
        viewFilteredFiles = files.filter(file => file.isFavorite);
        break;
      case 'recent':
        // Show files modified in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        viewFilteredFiles = files.filter(file => {
          const fileDate = new Date(file.modifiedDate);
          return fileDate > sevenDaysAgo;
        });
        break;
      case 'trash':
        // For now, show empty (trash functionality would need separate implementation)
        viewFilteredFiles = [];
        break;
      case 'dashboard':
      default:
        // Dashboard shows all files
        break;
    }

    // Apply search filters
    return useFileSearch(viewFilteredFiles, searchFilters);
  };

  const baseFilteredFiles = getFilteredFiles();

  // Apply additional filters using the new hook
  const { filteredFiles, totalCount: filteredTotalCount, filteredCount } = useFileFilters({
    files: baseFilteredFiles,
    viewMode,
    sortBy,
    sortDirection,
    filterType,
    searchQuery: searchFilters.query,
    selectedTags: searchFilters.tags
  });

  const handleFileClick = (file: FileItem) => {
    console.log('File clicked:', file);
    // Single click - could be used for selection in the future
  };

  const handleFileDoubleClick = (file: FileItem) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await removeFile(fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
      // You could show a toast notification here
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      await toggleFavorite(fileId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // You could show a toast notification here
    }
  };

  const handleFileUpdate = async (fileId: string, updates: Partial<FileItem>) => {
    try {
      await updateFile(fileId, updates);
      // Update the selected file if it's the one being updated
      if (selectedFile && selectedFile.id === fileId) {
        setSelectedFile({ ...selectedFile, ...updates });
      }
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  };

  const handleFileMove = async (fileId: string, projectId: string | null, folderId: string | null) => {
    try {
      await updateFile(fileId, { 
        projectId: projectId || undefined, 
        folderId: folderId || undefined 
      });
      
      // Refresh files to update the view
      setTimeout(() => {
        refreshFiles();
      }, 50);
    } catch (error) {
      console.error('Failed to move file:', error);
      throw error;
    }
  };

  const handleUploadComplete = (uploadedFiles: any[]) => {
    console.log('Upload completed, adding files to UI:', uploadedFiles);
    // Add the uploaded files to the state immediately
    if (uploadedFiles && uploadedFiles.length > 0) {
      addFiles(uploadedFiles);
    }
    // Also refresh to ensure we have the latest data
    setTimeout(() => {
      refreshFiles();
    }, 50);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setSelectedFile(null);
  };

  const handleSearchChange = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  const handleTagsChange = (tags: string[]) => {
    setSearchFilters(prev => ({ ...prev, tags }));
  };

  const handleViewChange = (view: string) => {
    console.log('Switching to view:', view);
    setActiveView(view);
    setShowProjectView(false);
    
    // Clear search when changing views for better UX
    setSearchFilters({ query: '', tags: [] });
    
    // Reset filters when changing views
    setFilterType('all');
    setSortBy('date');
    setSortDirection('desc');
    
    // Smart refresh: Only refresh if files have been updated
    if (shouldRefreshFiles() && ['dashboard', 'all-files', 'favorites', 'recent'].includes(view)) {
      console.log('Files have been updated, refreshing for view:', view);
      setTimeout(() => {
        refreshFiles();
        clearFilesUpdateFlag();
      }, 50);
    } else {
      console.log('No refresh needed for view:', view);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setShowProjectView(true);
    setActiveView('');
  };

  const handleBackFromProject = () => {
    setShowProjectView(false);
    setActiveView('dashboard');
    
    // Smart refresh: Only refresh if files have been updated
    if (shouldRefreshFiles()) {
      console.log('Files have been updated, refreshing after returning from project view');
      setTimeout(() => {
        refreshFiles();
        clearFilesUpdateFlag();
      }, 50);
    } else {
      console.log('No refresh needed when returning from project view');
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'projects':
        return 'Projects';
      case 'all-files':
        return 'All Files';
      case 'favorites':
        return 'Favorite Files';
      case 'recent':
        return 'Recent Files';
      case 'tags':
        return 'Tag Management';
      case 'trash':
        return 'Trash';
      case 'dashboard':
      default:
        return 'Dashboard';
    }
  };

  const getViewDescription = () => {
    switch (activeView) {
      case 'projects':
        return 'Organize your files into projects with folders and structure.';
      case 'all-files':
        return `All files in your current workspace. ${totalCount} items total.`;
      case 'favorites':
        return `Files you've marked as favorites. ${filteredFiles.length} items.`;
      case 'recent':
        return `Files modified in the last 7 days. ${filteredFiles.length} items.`;
      case 'tags':
        return 'Organize and manage tags across all your files.';
      case 'trash':
        return 'Deleted files (feature coming soon).';
      case 'dashboard':
      default:
        return `Manage your files and folders with ease. ${totalCount} items total.`;
    }
  };

  // Show loading state while files are loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your files...</p>
        </div>
      </div>
    );
  }

  // Show error state if files failed to load
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Something went wrong</h3>
          <p className="text-slate-400 mb-6">{error}</p>
          <button 
            onClick={refreshFiles}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar - Hidden on mobile by default */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:relative z-30 w-64 h-full transition-transform duration-300 ease-in-out`}>
        <Sidebar 
          className="h-full" 
          activeView={activeView}
          onViewChange={handleViewChange}
          onProjectSelect={handleProjectSelect}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {showProjectView ? (
          <ProjectView onBack={handleBackFromProject} />
        ) : (
          <>
            <TopBar 
              onMenuClick={handleMenuClick} 
              onUploadComplete={handleUploadComplete}
              onSearchChange={handleSearchChange}
              onTagsChange={handleTagsChange}
              searchQuery={searchFilters.query}
              selectedTags={searchFilters.tags}
              files={files}
            />
            <main className="flex-1 overflow-auto">
              {activeView === 'projects' ? (
                <ProjectGrid onProjectSelect={handleProjectSelect} />
              ) : activeView === 'tags' ? (
                <TagView />
              ) : (
                <FileGrid 
                  files={filteredFiles} 
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onFileDelete={handleFileDelete}
                  onToggleFavorite={handleToggleFavorite}
                  onFileUpdate={handleFileUpdate}
                  onFileMove={handleFileMove}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={activeView === 'dashboard' ? totalCount : filteredTotalCount}
                  hasNextPage={hasNextPage}
                  hasPrevPage={hasPrevPage}
                  onNextPage={nextPage}
                  onPrevPage={prevPage}
                  onGoToPage={goToPage}
                  viewTitle={getViewTitle()}
                  viewDescription={getViewDescription()}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  sortDirection={sortDirection}
                  onSortDirectionChange={setSortDirection}
                  filterType={filterType}
                  onFilterTypeChange={setFilterType}
                  showFilters={true}
                />
              )}
            </main>
          </>
        )}
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        isOpen={showPreview}
        onClose={handlePreviewClose}
        onUpdate={handleFileUpdate}
        onDelete={handleFileDelete}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}

function App() {
  return (
    <WorkspaceProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </WorkspaceProvider>
  );
}

export default App;