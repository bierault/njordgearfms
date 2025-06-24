import React, { useState } from 'react';
import { Plus, Folder, Calendar, Palette, MoreVertical, Users, FileText } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Project } from '../types/project';

interface ProjectGridProps {
  onProjectSelect: (projectId: string) => void;
  className?: string;
}

const ProjectGrid: React.FC<ProjectGridProps> = ({ onProjectSelect, className = '' }) => {
  const { projects, createProject, deleteProject, loading, error } = useProject();
  const { currentWorkspace } = useWorkspace();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  // Don't render if workspace is not available
  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-yellow-400 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Workspace Selected</h3>
          <p className="text-slate-400">Please select a workspace to view projects.</p>
        </div>
      </div>
    );
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim() || !currentWorkspace) return;

    try {
      await createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
        color: newProject.color,
        workspace_id: currentWorkspace.id
      });
      
      setNewProject({ name: '', description: '', color: '#3B82F6' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (window.confirm(`Are you sure you want to delete "${project.name}"? This will remove all folders and move files to the workspace.`)) {
      try {
        await deleteProject(projectId);
        setSelectedProject(null);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading projects...</p>
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
          <h3 className="text-lg font-medium text-white mb-2">Failed to load projects</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Projects</h1>
          <p className="text-slate-400">
            Organize your files into projects with folders and structure in <span className="text-blue-400">{currentWorkspace.name}</span>.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:bg-slate-750 hover:border-slate-600 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer transform hover:scale-105"
            onClick={() => onProjectSelect(project.id)}
          >
            {/* Project Header */}
            <div className="relative p-6 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: project.color }}
                >
                  <Folder className="w-6 h-6 text-white" />
                </div>
                
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(selectedProject === project.id ? null : project.id);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Project Menu */}
                  {selectedProject === project.id && (
                    <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 w-48 z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors duration-200"
                      >
                        <span>Delete Project</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors duration-200">
                {project.name}
              </h3>
              
              {project.description && (
                <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                  {project.description}
                </p>
              )}
            </div>

            {/* Project Stats */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1 text-slate-400">
                    <FileText className="w-4 h-4" />
                    <span>0 files</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Folder className="w-4 h-4" />
                    <span>0 folders</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-slate-500">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(project.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
            <p className="text-slate-400 mb-6">
              Create your first project to organize files with folders and structure in <span className="text-blue-400">{currentWorkspace.name}</span>.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Create Project
            </button>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Create New Project</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter project name..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your project..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Color
                  </label>
                  <div className="flex space-x-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewProject(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                          newProject.color === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Create Project
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProject({ name: '', description: '', color: '#3B82F6' });
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close project menu */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};

export default ProjectGrid;