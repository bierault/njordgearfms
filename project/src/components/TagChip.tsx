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
  const getVariantStyles = () => {
    switch (variant) {
      case 'selected':
        return 'bg-blue-600 text-white hover:bg-blue-700';
      case 'removable':
        return 'bg-slate-700 text-slate-300 hover:bg-slate-600 pr-1';
      default:
        return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
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