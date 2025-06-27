import React, { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import FileGrid from './components/FileGrid';
import FilePreviewModal from './components/FilePreviewModal';
import SharePage from './components/SharePage';
import ProjectV3View from './components/ProjectV3View';
import TagView from './components/TagView';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import GlobalSearchResults from './components/GlobalSearchResults';
import { WorkspaceProvider, useWorkspace, shouldRefreshFiles, clearFilesUpdateFlag } from './contexts/WorkspaceContext';
import { useFileData } from './hooks/useFileData';
import { useFileSearch, SearchFilters } from './hooks/useFileSearch';
import { useFileFilters } from './hooks/useFileFilters';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { ViewMode, SortOption, SortDirection, FilterType } from './components/FilterBar';
import { FileItem } from './components/FileCard';
import { supabase } from './lib/supabase';

// Fallback component for when workspace is not available
const WorkspaceSelectFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 mb-6">
        Setting up your workspace...
      </p>
    </div>
  </div>
);

// Error fallback component
const ErrorFallback: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-red-400 text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Something went wrong</h3>
      <p className="text-slate-400 mb-6 text-sm leading-relaxed">{error}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

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
    return <WorkspaceSelectFallback />;
  }

  // Show error state if workspace failed to load
  if (workspaceError) {
    return (
      <ErrorFallback 
        error={workspaceError} 
        onRetry={() => window.location.reload()} 
      />
    );
  }

  // Show fallback if no workspace is available
  if (!currentWorkspace) {
    return <WorkspaceSelectFallback />;
  }

  // Only render main content when workspace is fully loaded
  return <AppContentWithWorkspace currentWorkspace={currentWorkspace} />;
}

function AppContentWithWorkspace({ currentWorkspace }: { currentWorkspace: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showProjectV3View, setShowProjectV3View] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags: []
  });

  // Current user state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load current user
  React.useEffect(() => {
    loadCurrentUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
      } else if (event === 'SIGNED_IN' && session) {
        loadCurrentUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUser({
          id: user.id,
          email: user.email,
          role: profile?.role || 'employee',
          projectAccess: profile?.project_access || []
        });
        setIsAuthenticated(true);
      } else {
        // No user signed in
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setUserLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    loadCurrentUser();
  };

  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Get files for current workspace context with server-side sorting
  const { 
    files, 
    loading, 
    error, 
    currentPage,
    totalPages,
    totalCount,
    hasNextPage,
    hasPrevPage,
    sortBy: serverSortBy,
    sortDirection: serverSortDirection,
    toggleFavorite, 
    updateFile, 
    deleteFile,
    addFiles, 
    refreshFiles,
    nextPage,
    prevPage,
    goToPage,
    handleSortChange
  } = useFileData(false, false); // No trash view

  // Global search hook with smart matching
  const globalSearchResults = useGlobalSearch(
    searchFilters.query, 
    searchFilters.tags
  );

  // Determine if we should show global search results
  const shouldShowGlobalSearch = searchFilters.query.trim().length >= 2 || searchFilters.tags.length > 0;

  // Apply search filters using the hook - must be called at top level
  const searchFilteredFiles = useFileSearch(files, searchFilters);

  // Apply additional filters using the new hook - this handles favorites filtering
  const { filteredFiles, totalCount: filteredTotalCount, filteredCount } = useFileFilters({
    files: searchFilteredFiles,
    viewMode,
    sortBy: serverSortBy,
    sortDirection: serverSortDirection,
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

  const handleFileDelete = async (fileId: string) => {
    console.log('App: handleFileDelete called for:', fileId);
    try {
      await deleteFile(fileId);
      console.log('App: File deleted successfully');
      
      // Close preview if the deleted file was being previewed
      if (selectedFile && selectedFile.id === fileId) {
        setSelectedFile(null);
        setShowPreview(false);
      }
    } catch (error) {
      console.error('App: Failed to delete file:', error);
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

  const handleClearSearch = () => {
    setSearchFilters({ query: '', tags: [] });
  };

  const handleViewChange = (view: string) => {
    console.log('Switching to view:', view);
    
    // Handle Project V3 view
    if (view === 'project-v3') {
      setShowProjectV3View(true);
      setShowAdminDashboard(false);
      setActiveView('');
      return;
    }

    // Handle Admin Dashboard
    if (view === 'admin-dashboard') {
      setShowAdminDashboard(true);
      setShowProjectV3View(false);
      setActiveView('');
      return;
    }
    
    setActiveView(view);
    setShowProjectV3View(false);
    setShowAdminDashboard(false);
    
    // Clear search when changing views for better UX
    setSearchFilters({ query: '', tags: [] });
    
    // Reset filters when changing views
    setFilterType('all');
    
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

  const handleBackFromProjectV3 = () => {
    setShowProjectV3View(false);
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

  const handleBackFromAdminDashboard = () => {
    setShowAdminDashboard(false);
    setActiveView('dashboard');
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'all-files':
        return 'All Files';
      case 'favorites':
        return 'Favorites';
      case 'recent':
        return 'Recent';
      case 'tags':
        return 'Tags';
      case 'dashboard':
      default:
        return 'Dashboard';
    }
  };

  const getCurrentPageTitle = () => {
    if (showProjectV3View) {
      return 'Projects V3';
    }
    if (showAdminDashboard) {
      return 'Admin Dashboard';
    }
    return getViewTitle();
  };

  // Show loading state while user is loading
  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

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
      <ErrorFallback 
        error={error} 
        onRetry={refreshFiles} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar - Fixed position */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:relative z-30 h-full transition-transform duration-300 ease-in-out`}>
        <Sidebar 
          className="h-full" 
          activeView={showProjectV3View ? 'project-v3' : showAdminDashboard ? 'admin-dashboard' : activeView}
          onViewChange={handleViewChange}
          userRole={currentUser?.role || 'employee'}
          userProjectAccess={currentUser?.projectAccess || []}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content - With proper layout for scrolling */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 h-screen">
        {showAdminDashboard ? (
          <AdminDashboard onClose={handleBackFromAdminDashboard} />
        ) : showProjectV3View ? (
          <ProjectV3View onBack={handleBackFromProjectV3} />
        ) : (
          <>
            {/* Top Bar - Fixed */}
            <div className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700">
              <TopBar 
                onMenuClick={handleMenuClick} 
                onUploadComplete={handleUploadComplete}
                onSearchChange={handleSearchChange}
                onTagsChange={handleTagsChange}
                searchQuery={searchFilters.query}
                selectedTags={searchFilters.tags}
                files={files}
                currentPageTitle={getCurrentPageTitle()}
              />
            </div>
            
            {/* Main content area - Scrollable */}
            <main className="flex-1 overflow-auto">
              {shouldShowGlobalSearch ? (
                <GlobalSearchResults
                  query={searchFilters.query}
                  selectedTags={searchFilters.tags}
                  files={globalSearchResults.files}
                  loading={globalSearchResults.loading}
                  error={globalSearchResults.error}
                  totalResults={globalSearchResults.totalResults}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onToggleFavorite={handleToggleFavorite}
                  onFileUpdate={handleFileUpdate}
                  onFileMove={handleFileMove}
                  onClearSearch={handleClearSearch}
                  userRole={currentUser?.role || 'employee'}
                  userProjectAccess={currentUser?.projectAccess || []}
                />
              ) : activeView === 'tags' ? (
                <TagView />
              ) : (
                <FileGrid 
                  files={filteredFiles} 
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onToggleFavorite={handleToggleFavorite}
                  onFileUpdate={handleFileUpdate}
                  onFileMove={handleFileMove}
                  onFileDelete={handleFileDelete}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  hasNextPage={hasNextPage}
                  hasPrevPage={hasPrevPage}
                  onNextPage={nextPage}
                  onPrevPage={prevPage}
                  onGoToPage={goToPage}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  sortBy={serverSortBy}
                  onSortByChange={() => {}} // Not used with server-side sorting
                  sortDirection={serverSortDirection}
                  onSortDirectionChange={() => {}} // Not used with server-side sorting
                  filterType={filterType}
                  onFilterTypeChange={setFilterType}
                  showFilters={true}
                  onServerSortChange={handleSortChange}
                  userRole={currentUser?.role || 'employee'}
                  userProjectAccess={currentUser?.projectAccess || []}
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
        onToggleFavorite={handleToggleFavorite}
        userRole={currentUser?.role || 'employee'}
      />
    </div>
  );
}

function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

export default App;