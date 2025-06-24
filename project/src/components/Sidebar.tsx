import React from 'react';
import { 
  Folder, 
  Star, 
  Clock, 
  Trash2, 
  Tag, 
  Settings, 
  Home,
  FolderOpen,
  Briefcase,
  User
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface SidebarProps {
  className?: string;
  activeView?: string;
  onViewChange?: (view: string) => void;
  onProjectSelect?: (projectId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  className = '', 
  activeView = 'dashboard',
  onViewChange,
  onProjectSelect
}) => {
  const { projects, currentProject, switchProject } = useProject();

  const navigationItems = [
    { 
      id: 'dashboard', 
      icon: Home, 
      label: 'Dashboard', 
      description: 'Overview and stats'
    },
    { 
      id: 'projects', 
      icon: Briefcase, 
      label: 'Projects', 
      description: 'Manage projects'
    },
    { 
      id: 'all-files', 
      icon: FolderOpen, 
      label: 'All Files', 
      description: 'All files in workspace'
    },
    { 
      id: 'favorites', 
      icon: Star, 
      label: 'Favorites', 
      description: 'Starred files'
    },
    { 
      id: 'recent', 
      icon: Clock, 
      label: 'Recent', 
      description: 'Recently modified'
    },
    { 
      id: 'tags', 
      icon: Tag, 
      label: 'Tags', 
      description: 'Manage tags and tagged files'
    },
    { 
      id: 'trash', 
      icon: Trash2, 
      label: 'Trash', 
      description: 'Deleted files'
    },
  ];

  const handleNavClick = (viewId: string) => {
    onViewChange?.(viewId);
  };

  const handleProjectClick = (projectId: string) => {
    switchProject(projectId);
    onProjectSelect?.(projectId);
  };

  return (
    <div className={`bg-slate-900 border-r border-slate-700 flex flex-col ${className}`}>
      {/* Navigation */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Main Navigation */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Navigation
          </h3>
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 group ${
                  activeView === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={item.description}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom Section - Settings and Account */}
      <div className="p-4 border-t border-slate-700 space-y-1">
        <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-200">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
        
        <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-200">
          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-white truncate">Anonymous User</div>
            <div className="text-xs text-slate-400 truncate">guest@filevault.com</div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;