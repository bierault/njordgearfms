import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { getAllTags } from '../hooks/useFileSearch';
import { useFileData } from '../hooks/useFileData';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  placeholder = "Add tag...",
  disabled = false,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get all existing tags for suggestions
  const { files } = useFileData();
  const allExistingTags = getAllTags(files);

  // Normalize tag function (lowercase, trim)
  const normalizeTag = (tag: string): string => {
    return tag.toLowerCase().trim();
  };

  // Filter suggestions based on input
  const suggestions = allExistingTags.filter(tag => 
    tag.toLowerCase().includes(inputValue.toLowerCase()) &&
    !tags.some(existingTag => normalizeTag(existingTag) === normalizeTag(tag)) &&
    inputValue.trim().length > 0
  ).slice(0, 5); // Limit to 5 suggestions

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagToAdd: string = inputValue) => {
    const trimmedTag = tagToAdd.trim();
    if (!trimmedTag) return;

    const normalizedNewTag = normalizeTag(trimmedTag);
    
    // Check if tag already exists (case-insensitive)
    const existingTag = tags.find(tag => normalizeTag(tag) === normalizedNewTag);
    
    if (existingTag) {
      // Tag already exists, don't add duplicate but clear input
      setInputValue('');
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      return;
    }

    // Check if there's an existing tag in the system with different case
    const systemExistingTag = allExistingTags.find(tag => normalizeTag(tag) === normalizedNewTag);
    
    if (systemExistingTag) {
      // Use the existing tag's case from the system
      onTagsChange([...tags, systemExistingTag]);
    } else {
      // Add new tag with user's case
      onTagsChange([...tags, trimmedTag]);
    }
    
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.trim().length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        addTag(suggestions[selectedSuggestionIndex]);
      } else if (inputValue.trim()) {
        addTag();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag when backspacing on empty input
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
              {!disabled && (
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-2 hover:text-blue-200 transition-colors duration-200"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.trim().length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
          />
          {!disabled && (
            <button
              onClick={() => addTag()}
              disabled={!inputValue.trim()}
              type="button"
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 ${
                  index === selectedSuggestionIndex
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                type="button"
              >
                <div className="flex items-center space-x-2">
                  <Tag className="w-3 h-3" />
                  <span>{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;