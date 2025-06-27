import React, { useState } from 'react';
import ProjectSelectionView from './ProjectSelectionView';
import ProjectWorkspaceView from './ProjectWorkspaceView';

interface ProjectV3ViewProps {
  onBack: () => void;
}

const ProjectV3View: React.FC<ProjectV3ViewProps> = ({ onBack }) => {
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const handleProjectSelect = (project: any) => {
    setSelectedProject(project);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
  };

  const handleBackToMain = () => {
    setSelectedProject(null);
    onBack();
  };

  if (selectedProject) {
    return (
      <ProjectWorkspaceView 
        project={selectedProject} 
        onBack={handleBackToProjects} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackToMain}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Projects</h1>
        </div>
      </div>

      {/* Project Selection */}
      <ProjectSelectionView onProjectSelect={handleProjectSelect} />
    </div>
  );
};

export default ProjectV3View;