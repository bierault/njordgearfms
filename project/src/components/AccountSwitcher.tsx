import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  ChevronDown, 
  Shield, 
  Users, 
  LogOut,
  Crown
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AccountSwitcherProps {
  currentRole?: 'admin' | 'employee';
  onAdminDashboard?: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ 
  currentRole = 'employee',
  onAdminDashboard 
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load current user on mount
  useEffect(() => {
    loadCurrentUser();
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
          name: profile?.name || 'User',
          role: profile?.role || 'employee'
        });
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAccountMenu]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAdminDashboard = () => {
    onAdminDashboard?.();
    setShowAccountMenu(false);
  };

  if (loading) {
    return (
      <div className="w-full px-3 py-2 rounded-lg bg-slate-800 animate-pulse">
        <div className="h-10 bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="w-full px-3 py-2 rounded-lg bg-slate-800">
        <p className="text-slate-400 text-sm">Not signed in</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Current Account Button */}
      <button
        onClick={() => setShowAccountMenu(!showAccountMenu)}
        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-200"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          currentUser.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'
        }`}>
          {currentUser.role === 'admin' ? (
            <Crown className="w-4 h-4 text-white" />
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {currentUser.email}
          </div>
          <div className="text-xs text-slate-400 truncate flex items-center space-x-1">
            <span>{currentUser.role}</span>
            {currentUser.role === 'admin' && (
              <Shield className="w-3 h-3 text-purple-400" />
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
          showAccountMenu ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Account Menu */}
      {showAccountMenu && (
        <div className="absolute bottom-full left-0 mb-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 z-50">
          <div className="px-2">
            {/* User Info Header */}
            <div className="px-3 py-2 border-b border-slate-700 mb-2">
              <div className="text-sm font-medium text-white">{currentUser.email}</div>
              <div className="text-xs text-slate-400 capitalize">{currentUser.role}</div>
            </div>

            {/* Admin Dashboard (only for admins) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={handleAdminDashboard}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
              >
                <Users className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSwitcher;