import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Plus, 
  Search, 
  Crown, 
  User, 
  Mail, 
  Building, 
  Shield,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  name: string;
  email: string;
  workspaces: string[];
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { workspaces } = useWorkspace();

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    workspaceIds: [] as string[]
  });

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      
      // Load users from database
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          *,
          workspace:workspaces(name, color)
        `)
        .eq('role', 'employee');

      if (error) {
        console.error('Error loading employees:', error);
        return;
      }

      // Convert to Employee format
      const employeeData: Employee[] = (users || []).map(user => ({
        id: user.id,
        name: user.name || 'Unknown',
        email: user.email,
        workspaces: user.workspace ? [user.workspace.name] : [],
        status: 'active', // TODO: Determine from auth status
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastLogin: undefined // TODO: Get from auth.users
      }));

      setEmployees(employeeData);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.workspaces.some(ws => ws.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password || newEmployee.workspaceIds.length === 0) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Create auth user first
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newEmployee.email,
        password: newEmployee.password,
        email_confirm: true,
        user_metadata: {
          name: newEmployee.name,
          role: 'employee'
        }
      });

      if (authError) {
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user data returned');
      }

      // Create user profile - use the first selected workspace as primary
      const primaryWorkspaceId = newEmployee.workspaceIds[0];
      
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: newEmployee.email,
          name: newEmployee.name,
          role: 'employee',
          workspace_id: primaryWorkspaceId,
          project_access: []
        });

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // Generate invite link
      const inviteUrl = `${window.location.origin}/login?email=${encodeURIComponent(newEmployee.email)}`;
      setInviteLink(inviteUrl);

      setSubmitStatus('success');
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        workspaceIds: []
      });

      // Reload employees
      await loadEmployees();

    } catch (error) {
      console.error('Error creating employee:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      // Delete user profile (this will cascade to auth.users)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', employeeId);

      if (error) {
        throw new Error(`Failed to delete employee: ${error.message}`);
      }

      // Reload employees
      await loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  };

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-slate-900">
        <div className="text-center">
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">Manage employees and permissions</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Total Employees</p>
                  <p className="text-3xl font-bold text-white mt-2">{employees.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Active Users</p>
                  <p className="text-3xl font-bold text-white mt-2">
                    {employees.filter(e => e.status === 'active').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Workspaces</p>
                  <p className="text-3xl font-bold text-white mt-2">{workspaces.length}</p>
                </div>
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowAddEmployee(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Add Employee</span>
            </button>
          </div>

          {/* Employee List */}
          <div className="bg-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Workspaces
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-600 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-white font-medium">{employee.name}</div>
                            <div className="text-slate-400 text-sm">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {employee.workspaces.map((workspace, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded-md"
                            >
                              {workspace}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(employee.status)}`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-sm">
                        {employee.createdAt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedEmployee(employee)}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                            title="Edit employee"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            disabled={isSubmitting}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors duration-200 disabled:opacity-50"
                            title="Delete employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-500">No employees found</p>
                <p className="text-slate-600 text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Add your first employee to get started'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Add New Employee</h3>
                <button
                  onClick={() => {
                    setShowAddEmployee(false);
                    setSubmitStatus(null);
                    setInviteLink(null);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {submitStatus === 'success' && inviteLink ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white">Employee Created Successfully!</h4>
                  <p className="text-slate-400">
                    The employee account has been created. Share this login information:
                  </p>
                  <div className="bg-slate-700 border border-slate-600 rounded-lg p-4 space-y-2">
                    <div className="text-left">
                      <p className="text-slate-400 text-sm">Email:</p>
                      <p className="text-white font-mono">{newEmployee.email}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-slate-400 text-sm">Password:</p>
                      <p className="text-white font-mono">{newEmployee.password}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-slate-400 text-sm">Login URL:</p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={inviteLink}
                          readOnly
                          className="flex-1 bg-transparent text-white text-sm font-mono"
                        />
                        <button
                          onClick={copyInviteLink}
                          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddEmployee(false);
                      setSubmitStatus(null);
                      setInviteLink(null);
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Employee Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter full name..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newEmployee.password}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password..."
                        className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Workspace Access */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Workspace Access (Select Multiple)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-600 rounded-lg p-3 bg-slate-700">
                      {workspaces.map((workspace) => (
                        <label key={workspace.id} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newEmployee.workspaceIds.includes(workspace.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEmployee(prev => ({
                                  ...prev,
                                  workspaceIds: [...prev.workspaceIds, workspace.id]
                                }));
                              } else {
                                setNewEmployee(prev => ({
                                  ...prev,
                                  workspaceIds: prev.workspaceIds.filter(id => id !== workspace.id)
                                }));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: workspace.color }}
                            />
                            <span className="text-white text-sm">{workspace.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {newEmployee.workspaceIds.length === 0 && (
                      <p className="text-slate-500 text-xs mt-1">Select at least one workspace</p>
                    )}
                    {newEmployee.workspaceIds.length > 0 && (
                      <p className="text-blue-400 text-xs mt-1">
                        Selected {newEmployee.workspaceIds.length} workspace{newEmployee.workspaceIds.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Error Message */}
                  {submitStatus === 'error' && (
                    <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <span className="text-red-400 text-sm">
                        Please fill in all required fields and select at least one workspace
                      </span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleAddEmployee}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          <span>Create Employee Account</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEmployee(false);
                        setSubmitStatus(null);
                        setInviteLink(null);
                      }}
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;