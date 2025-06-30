import React from 'react';

interface TagChipProps {
  tag: string;
  variant?: 'default' | 'selected' | 'removable';
  onClick?: (tag: string) => void;
  onRemove?: (tag: string) => void;
  className?: string;
}

const TagChip: React.FC<TagChipProps> = ({
  tag,
  variant = 'default',
  onClick,
  onRemove,
  className = ''
}) => {
  // Get tag color based on tag name
  const getTagColor = (tag: string) => {
    const colors = [
      'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
      'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30',
      'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30',
      'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30',
      'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30',
      'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-pink-500/30',
      'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30'
    ];
    
    // Use tag name to generate consistent color
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'selected':
        return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700';
      case 'removable':
        return `${getTagColor(tag)} pr-1 border`;
      default:
        return `${getTagColor(tag)} border`;
    }
  };

  const handleClick = () => {
    onClick?.(tag);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(tag);
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors duration-200 ${getVariantStyles()} ${className}`}
      onClick={handleClick}
    >
      {tag}
      {variant === 'removable' && onRemove && (
        <button
          onClick={handleRemove}
          className="ml-1 hover:text-red-300 transition-colors duration-200"
          title="Remove tag"
        >
          ×
        </button>
      )}
    </span>
  );
};

export default TagChip;