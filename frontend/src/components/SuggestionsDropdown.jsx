import { useState, useEffect, useRef } from "react";
import "./SuggestionsDropdown.css";

/**
 * Google-like autocomplete dropdown
 * Features:
 *  - Arrow key navigation
 *  - Keyboard shortcuts (Enter to select, Esc to close)
 *  - Smooth animations
 *  - Search icon for each suggestion
 *  - Highlighted matching text
 */
export default function SuggestionsDropdown({
  suggestions = [],
  query = "",
  isOpen = false,
  isLoading = false,
  onSuggestionClick,
  onClose,
}) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const selectedItemRef = useRef(null);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            // User selected a suggestion, use it
            onSuggestionClick(suggestions[selectedIndex]);
          } else {
            // No suggestion selected, close dropdown and let parent handle search
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, suggestions, onSuggestionClick, onClose]);

  if (!isOpen || (!suggestions.length && !isLoading)) {
    return null;
  }

  /**
   * Highlight matching part of suggestion
   * E.g., query="geo" and suggestion="geothermal" → "geo" is bolded
   */
  const highlightMatch = (text, searchTerm) => {
    if (!searchTerm) return text;

    const lowerText = text.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerSearch);

    if (index === -1) return text;

    return (
      <>
        <span className="sug-highlight">
          {text.substring(0, index)}
        </span>
        <span className="sug-match">{text.substring(index, index + searchTerm.length)}</span>
        <span className="sug-highlight">
          {text.substring(index + searchTerm.length)}
        </span>
      </>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="suggestions-dropdown"
      role="listbox"
    >
      {isLoading ? (
        <div className="suggestions-loading">
          <div className="spinner"></div>
          <span>Loading suggestions...</span>
        </div>
      ) : suggestions.length > 0 ? (
        <ul className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion}-${index}`}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={`suggestion-item ${
                index === selectedIndex ? "selected" : ""
              }`}
              onClick={() => onSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <svg
                className="suggestion-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" />
                <path
                  d="M11 11l3 3"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>

              <span className="suggestion-text">
                {highlightMatch(suggestion, query)}
              </span>

              <svg
                className="suggestion-arrow"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M6 2l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
