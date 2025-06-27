import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Folder, Check, AlertTriangle, Edit3, Save, X } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import WorkspaceManager from './WorkspaceManager';
import { supabase } from '../lib/supabase';

interface WorkspaceSelectorProps {
  className?: string;
  onClose?: () => void;
  isDropdown?: boolean;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ 
  className = '', 
  onClose,
  isDropdown = false 
}) => {
  const [showManager, setShowManager] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessibleWorkspaces, setAccessibleWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace, workspaces, switchWorkspace, updateWorkspace, loading: workspaceLoading, error } = useWorkspace();

  // Load current user and determine accessible workspaces
  useEffect(() => {
    const loadUserAndWorkspaces = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Get user profile with role and project access
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (profile) {
            setCurrentUser({
              id: user.id,
              email: user.email,
              role: profile.role || 'employee',
              workspace_id: profile.workspace_id,
              project_access: profile.project_access || []
            });
            
            // If admin, all workspaces are accessible
            if (profile.role === 'admin') {
              setAccessibleWorkspaces(workspaces);
            } else {
              // For employees, get workspaces they have access to
              const accessibleWorkspaceIds = new Set<string>();
              
              // Add primary workspace
              if (profile.workspace_id) {
                accessibleWorkspaceIds.add(profile.workspace_id);
              }
              
              // Add workspaces from project access
              if (profile.project_access && profile.project_access.length > 0) {
                const { data: projects } = await supabase
                  .from('projects')
                  .select('workspace_id')
                  .in('id', profile.project_access);
                  
                if (projects) {
                  projects.forEach(project => {
                    if (project.workspace_id) {
                      accessibleWorkspaceIds.add(project.workspace_id);
                    }
                  });
                }
              }
              
              // Filter workspaces to only those the user has access to
              const filteredWorkspaces = workspaces.filter(workspace => 
                accessibleWorkspaceIds.has(workspace.id)
              );
              
              setAccessibleWorkspaces(filteredWorkspaces);
            }
          } else {
            // No profile found, default to all workspaces
            setAccessibleWorkspaces(workspaces);
          }
        } else {
          // No user, default to all workspaces
          setAccessibleWorkspaces(workspaces);
        }
      } catch (error) {
        console.error('Error loading user and workspaces:', error);
        setAccessibleWorkspaces(workspaces);
      } finally {
        setLoading(false);
      }
    };
    
    if (!workspaceLoading && workspaces.length > 0) {
      loadUserAndWorkspaces();
    }
  }, [workspaces, workspaceLoading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isDropdown && onClose) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdown, onClose]);

  const handleWorkspaceSelect = (workspaceId: string) => {
    try {
      switchWorkspace(workspaceId);
      if (isDropdown && onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error selecting workspace:', err);
    }
  };

  const handleStartEdit = (workspace: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspace(workspace.id);
    setEditName(workspace.name);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingWorkspace || !editName.trim()) return;

    try {
      await updateWorkspace(editingWorkspace, { name: editName.trim() });
      setEditingWorkspace(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update workspace:', error);
      alert('Failed to update workspace name. Please try again.');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspace(null);
    setEditName('');
  };

  // Loading state
  if (loading || workspaceLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-10 bg-slate-700 rounded-lg w-48"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">Workspace Error</span>
        </div>
      </div>
    );
  }

  // No workspace state
  if (!currentWorkspace) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-sm">No Workspace</span>
        </div>
      </div>
    );
  }

  // If no accessible workspaces, show message
  if (accessibleWorkspaces.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-sm">No Accessible Workspaces</span>
        </div>
      </div>
    );
  }

  // If used as dropdown from logo, render directly
  if (isDropdown) {
    return (
      <>
        <div 
          className={`fixed top-16 left-4 right-4 md:left-auto md:right-auto md:w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-2 max-h-80 overflow-y-auto ${className}`} 
          ref={dropdownRef}
        >
          {/* Current Workspace Header */}
          <div className="px-4 py-3 border-b border-slate-700">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Current Workspace
            </div>
            <div className="flex items-center space-x-3">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentWorkspace.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {currentWorkspace.name}
                </div>
              </div>
            </div>
          </div>

          {/* Workspace List */}
          <div className="px-2 py-2">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">
              Switch Workspace
            </div>
            {accessibleWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 group"
              >
                <button
                  onClick={() => handleWorkspaceSelect(workspace.id)}
                  className="flex items-center space-x-3 flex-1 min-w-0 text-left"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: workspace.color }}
                  />
                  <div className="flex-1 min-w-0">
                    {editingWorkspace === workspace.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(e)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-sm bg-slate-600 border border-slate-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className="text-white font-medium truncate group-hover:text-blue-400">
                        {workspace.name}
                      </div>
                    )}
                  </div>
                  {currentWorkspace.id === workspace.id && !editingWorkspace && (
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                </button>
                
                {/* Edit/Save/Cancel buttons - Only for admins */}
                {currentUser?.role === 'admin' && (
                  <div className="flex items-center space-x-1">
                    {editingWorkspace === workspace.id ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          className="p-1 rounded text-green-400 hover:text-green-300 hover:bg-slate-600 transition-colors duration-200"
                          title="Save"
                        >
                          <Save className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => handleStartEdit(workspace, e)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                        title="Rename workspace"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Workspace Manager Modal - Only for admins */}
        {currentUser?.role === 'admin' && (
          <WorkspaceManager
            isOpen={showManager}
            onClose={() => setShowManager(false)}
          />
        )}
      </>
    );
  }

  // Original inline version (if still needed elsewhere)
  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Current Workspace Button */}
        <button
          className="flex items-center space-x-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors duration-200 min-w-[200px]"
        >
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentWorkspace.color }}
          />
          <div className="flex-1 text-left min-w-0">
            <div className="text-white font-medium truncate">
              {currentWorkspace.name}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Workspace Manager Modal - Only for admins */}
      {currentUser?.role === 'admin' && (
        <WorkspaceManager
          isOpen={showManager}
          onClose={() => setShowManager(false)}
        />
      )}
    </>
  );
};

export default WorkspaceSelector;