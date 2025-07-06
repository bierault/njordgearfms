import React, { useState, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Settings, 
  Users, 
  Folder,
  Calendar,
  Palette,
  Save,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Workspace } from '../types/workspace';

interface WorkspaceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ isOpen, onClose }) => {
  const { 
    workspaces, 
    currentWorkspace, 
    createWorkspace, 
    updateWorkspace, 
    deleteWorkspace,
    switchWorkspace 
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'edit'>('overview');
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ];

  const resetForm = useCallback(() => {
    setFormData({ name: '', description: '', color: '#3B82F6' });
    setEditingWorkspace(null);
    setError(null);
    setSuccess(null);
  }, []);

  const handleCreateWorkspace = useCallback(async () => {
    if (!formData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newWorkspace = await createWorkspace({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color
      });

      setSuccess(`Workspace "${newWorkspace.name}" created successfully!`);
      resetForm();
      setActiveTab('overview');
      
      // Auto-switch to new workspace
      setTimeout(() => {
        switchWorkspace(newWorkspace.id);
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, createWorkspace, resetForm, switchWorkspace]);

  const handleUpdateWorkspace = useCallback(async () => {
    if (!editingWorkspace || !formData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateWorkspace(editingWorkspace.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color
      });

      setSuccess(`Workspace "${formData.name}" updated successfully!`);
      resetForm();
      setActiveTab('overview');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingWorkspace, formData, updateWorkspace, resetForm]);

  const handleDeleteWorkspace = useCallback(async (workspace: Workspace) => {
    if (workspaces.length <= 1) {
      setError('Cannot delete the last workspace');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${workspace.name}"? This action cannot be undone and will remove all files in this workspace.`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteWorkspace(workspace.id);
      setSuccess(`Workspace "${workspace.name}" deleted successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setIsSubmitting(false);
    }
  }, [workspaces.length, deleteWorkspace]);

  const startEdit = useCallback((workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setFormData({
      name: workspace.name,
      description: workspace.description || '',
      color: workspace.color
    });
    setActiveTab('edit');
    setError(null);
    setSuccess(null);
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setActiveTab('create');
  }, [resetForm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Workspace Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'overview'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={startCreate}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'create'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Workspace
          </button>
          {editingWorkspace && (
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
                activeTab === 'edit'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Edit Workspace
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-green-400">{success}</span>
              <button
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-400 hover:text-green-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Your Workspaces ({workspaces.length})</h3>
                <button
                  onClick={startCreate}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Workspace</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`p-6 rounded-xl border transition-all duration-200 ${
                      currentWorkspace?.id === workspace.id
                        ? 'bg-blue-600/10 border-blue-500/30'
                        : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: workspace.color }}
                        />
                        <div>
                          <h4 className="text-white font-bold">{workspace.name}</h4>
                          {currentWorkspace?.id === workspace.id && (
                            <span className="text-xs text-blue-400 font-medium">Current</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => startEdit(workspace)}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors duration-200"
                          title="Edit workspace"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {workspaces.length > 1 && (
                          <button
                            onClick={() => handleDeleteWorkspace(workspace)}
                            disabled={isSubmitting}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors duration-200 disabled:opacity-50"
                            title="Delete workspace"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {workspace.description && (
                      <p className="text-slate-400 text-sm mb-4">{workspace.description}</p>
                    )}

                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(workspace.created_at)}</span>
                      </div>
                      
                      {currentWorkspace?.id !== workspace.id && (
                        <button
                          onClick={() => switchWorkspace(workspace.id)}
                          className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create/Edit Form */}
          {(activeTab === 'create' || activeTab === 'edit') && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">
                {activeTab === 'create' ? 'Create New Workspace' : `Edit "${editingWorkspace?.name}"`}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter workspace name..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your workspace..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Color Theme
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`w-10 h-10 rounded-lg transition-all duration-200 ${
                          formData.color === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-700">
                <button
                  onClick={activeTab === 'create' ? handleCreateWorkspace : handleUpdateWorkspace}
                  disabled={!formData.name.trim() || isSubmitting}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting 
                      ? (activeTab === 'create' ? 'Creating...' : 'Updating...')
                      : (activeTab === 'create' ? 'Create Workspace' : 'Update Workspace')
                    }
                  </span>
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setActiveTab('overview');
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceManager;