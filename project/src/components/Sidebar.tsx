import React, { useState } from 'react';
import { 
  Star, 
  Clock, 
  Tag, 
  Home,
  User,
  Shield,
  FolderTree,
  ChevronDown,
  Users
}  from 'lucide-react';
import AccountSwitcher from './AccountSwitcher';
import WorkspaceSelector from './WorkspaceSelector';
import { useWorkspace } from '../contexts/WorkspaceContext';
import logoImage from '../assets/images.png';

interface SidebarProps {
  className?: string;
  activeView?: string;
  onViewChange?: (view: string) => void;
  userRole?: 'admin' | 'employee';
  userProjectAccess?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  className = '', 
  activeView = 'dashboard',
  onViewChange,
  userRole = 'employee',
  userProjectAccess = []
}) => {
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const { currentWorkspace } = useWorkspace();

  const navigationItems = [
    { 
      id: 'dashboard', 
      icon: Home, 
      label: 'Dashboard',
      adminOnly: false
    },
    { 
      id: 'recent', 
      icon: Clock, 
      label: 'Recent',
      adminOnly: false
    },
    { 
      id: 'favorites', 
      icon: Star, 
      label: 'Favorites',
      adminOnly: false
    }
  ];

  const secondaryItems = [
    { 
      id: 'project-v3', 
      icon: FolderTree, 
      label: 'Projects',
      adminOnly: false
    },
    // Show Tags for all users - employees can view but not edit
    { 
      id: 'tags', 
      icon: Tag, 
      label: 'Tags',
      adminOnly: false
    },
    // Only show Admin Dashboard for admins
    ...(userRole === 'admin' ? [{ 
      id: 'admin-dashboard', 
      icon: Users, 
      label: 'Admin Dashboard',
      adminOnly: true
    }] : [])
  ];

  const filteredNavigationItems = navigationItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );

  const filteredSecondaryItems = secondaryItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );

  const handleNavClick = (viewId: string) => {
    const item = [...navigationItems, ...secondaryItems].find(nav => nav.id === viewId);
    if (userRole === 'employee' && item?.adminOnly) {
      return;
    }
    onViewChange?.(viewId);
  };

  const handleAdminDashboard = () => {
    onViewChange?.('admin-dashboard');
  };

  const handleWorkspaceToggle = () => {
    setShowWorkspaceDropdown(!showWorkspaceDropdown);
  };

  return (
    <div className={`bg-slate-900 border-r border-slate-700 flex flex-col w-64 h-screen fixed left-0 top-0 ${className}`}>
      {/* Njordgear FMS with Simple Workspace Dropdown */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="relative">
          <button
            onClick={handleWorkspaceToggle}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src={logoImage} 
                  alt="Njordgear" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left">
                <div className="text-white font-semibold text-sm">Njordgear FMS</div>
                {currentWorkspace && (
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: currentWorkspace.color }}
                    />
                    <span className="text-xs text-slate-300">{currentWorkspace.name}</span>
                  </div>
                )}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              showWorkspaceDropdown ? 'rotate-180' : ''
            }`} />
          </button>

          {/* Simple Workspace Dropdown */}
          {showWorkspaceDropdown && (
            <WorkspaceSelector 
              onClose={() => setShowWorkspaceDropdown(false)}
              isDropdown={true}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {/* Main Navigation */}
        <nav className="space-y-0.5 mb-3">
          {filteredNavigationItems.map((item) => {
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-3"></div>

        {/* Secondary Navigation */}
        <nav className="space-y-0.5">
          {filteredSecondaryItems.map((item) => {
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Employee Notice - Only show in sidebar for employees */}
        {userRole === 'employee' && (
          <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">Employee Account</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Limited access. Contact admin for additional permissions.
            </p>
          </div>
        )}
      </div>

      {/* Account Switcher - Fixed at bottom */}
      <div className="p-4 border-t border-slate-700/50 mt-auto">
        <AccountSwitcher 
          currentRole={userRole}
          onAdminDashboard={handleAdminDashboard}
        />
      </div>

      {/* Click outside to close dropdown */}
      {showWorkspaceDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowWorkspaceDropdown(false)}
        />
      )}
    </div>
  );
}

export default Sidebar;