import React, { useState } from 'react';
import { Zap, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useAutoTagging } from '../hooks/useAutoTagging';

interface AutoTaggingButtonProps {
  fileId: string;
  currentTags: string[];
  onTagsUpdated: (newTags: string[]) => void;
  className?: string;
}

const AutoTaggingButton: React.FC<AutoTaggingButtonProps> = ({
  fileId,
  currentTags,
  onTagsUpdated,
  className = ''
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const { triggerAutoTagging } = useAutoTagging();

  const handleAutoTag = async () => {
    setIsProcessing(true);
    setStatus('idle');
    setMessage('');

    try {
      const result = await triggerAutoTagging(fileId);
      
      if (result.success) {
        setStatus('success');
        setMessage('Auto-tagging request sent! Tags will be updated shortly.');
        
        // Note: The actual tag updates will come through the n8n webhook
        // and will be reflected in the UI through real-time updates
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Auto-tagging failed');
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 5000);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to trigger auto-tagging');
      
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonContent = () => {
    if (isProcessing) {
      return (
        <>
          <Loader className="w-4 h-4 animate-spin" />
          <span>Analyzing...</span>
        </>
      );
    }

    if (status === 'success') {
      return (
        <>
          <CheckCircle className="w-4 h-4" />
          <span>Sent for Analysis</span>
        </>
      );
    }

    if (status === 'error') {
      return (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>Try Again</span>
        </>
      );
    }

    return (
      <>
        <Zap className="w-4 h-4" />
        <span>AI Auto-tag</span>
      </>
    );
  };

  const getButtonStyles = () => {
    if (status === 'success') {
      return 'bg-green-600 hover:bg-green-700 text-white';
    }
    
    if (status === 'error') {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    
    return 'bg-blue-600 hover:bg-blue-700 text-white';
  };

  return (
    <div className={className}>
      <button
        onClick={handleAutoTag}
        disabled={isProcessing}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${getButtonStyles()}`}
      >
        {getButtonContent()}
      </button>
      
      {message && (
        <p className={`text-xs mt-2 ${
          status === 'success' ? 'text-green-400' : 
          status === 'error' ? 'text-red-400' : 
          'text-slate-400'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default AutoTaggingButton;