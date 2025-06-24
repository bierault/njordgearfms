import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Settings, Folder, Check } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import WorkspaceManager from './WorkspaceManager';

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
  const [isOpen, setIsOpen] = useState(isDropdown);
  const [showManager, setShowManager] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace, workspaces, switchWorkspace, loading } = useWorkspace();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isDropdown && onClose) {
          onClose();
        } else {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isDropdown, onClose]);

  const handleWorkspaceSelect = (workspaceId: string) => {
    switchWorkspace(workspaceId);
    if (isDropdown && onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  const handleManageWorkspaces = () => {
    setShowManager(true);
    if (isDropdown && onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  if (loading || !currentWorkspace) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-10 bg-slate-700 rounded-lg w-48"></div>
      </div>
    );
  }

  // If used as dropdown from logo, render directly
  if (isDropdown) {
    return (
      <>
        <div className={`bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-2 w-80 max-h-80 overflow-y-auto ${className}`} ref={dropdownRef}>
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
                {currentWorkspace.description && (
                  <div className="text-xs text-slate-400 truncate">
                    {currentWorkspace.description}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workspace List */}
          <div className="px-2 py-2">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">
              Switch Workspace
            </div>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left hover:bg-slate-700 transition-colors duration-200 group"
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: workspace.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate group-hover:text-blue-400">
                    {workspace.name}
                  </div>
                  {workspace.description && (
                    <div className="text-xs text-slate-400 truncate">
                      {workspace.description}
                    </div>
                  )}
                </div>
                {currentWorkspace.id === workspace.id && (
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 my-2" />

          {/* Actions */}
          <div className="px-2">
            <button 
              onClick={handleManageWorkspaces}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left hover:bg-slate-700 transition-colors duration-200 text-slate-300 hover:text-white"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Manage Workspaces</span>
            </button>
          </div>
        </div>

        {/* Workspace Manager Modal */}
        <WorkspaceManager
          isOpen={showManager}
          onClose={() => setShowManager(false)}
        />
      </>
    );
  }

  // Original inline version (if still needed elsewhere)
  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Current Workspace Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
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
            {currentWorkspace.description && (
              <div className="text-xs text-slate-400 truncate">
                {currentWorkspace.description}
              </div>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
            {/* Workspace List */}
            <div className="px-2">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">
                Workspaces
              </div>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace.id)}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left hover:bg-slate-700 transition-colors duration-200 group"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: workspace.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate group-hover:text-blue-400">
                      {workspace.name}
                    </div>
                    {workspace.description && (
                      <div className="text-xs text-slate-400 truncate">
                        {workspace.description}
                      </div>
                    )}
                  </div>
                  {currentWorkspace.id === workspace.id && (
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700 my-2" />

            {/* Actions */}
            <div className="px-2">
              <button 
                onClick={handleManageWorkspaces}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left hover:bg-slate-700 transition-colors duration-200 text-slate-300 hover:text-white"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Manage Workspaces</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace Manager Modal */}
      <WorkspaceManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />
    </>
  );
};

export default WorkspaceSelector;