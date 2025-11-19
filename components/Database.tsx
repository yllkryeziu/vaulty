import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FileText, Hash, ChevronRight, ChevronDown, X, Filter, Folder, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getExercises, organizeByCourse, getAllTags, getImageUrl, deleteExercise, deleteCourse } from '../services/db';
import { Exercise } from '../types';

interface CourseNode {
  name: string;
  weeks: Record<number, Exercise[]>;
}

export const Database = () => {
  const [searchParams] = useSearchParams();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Tag Filter State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Tree Expansion State - auto-expand weeks when filtering
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // Confirmation Dialog State
  const [showDeleteExerciseDialog, setShowDeleteExerciseDialog] = useState(false);
  const [showDeleteCourseDialog, setShowDeleteCourseDialog] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  // Load exercises
  useEffect(() => {
    getExercises().then(data => {
      setExercises(data);
      // Auto-select first course if available
      if (data.length > 0 && !searchParams.get('course')) {
        setSelectedCourse(data[0].course);
      }
    });
  }, []);

  // React to 'course' query param changes
  useEffect(() => {
    const courseParam = searchParams.get('course');
    if (courseParam) {
      setSelectedCourse(courseParam);
    }
  }, [searchParams]);

  // Click outside handler for tag dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allTags = useMemo(() => getAllTags(exercises), [exercises]);

  const availableTags = useMemo(() => {
    return allTags.filter(tag =>
      !selectedTags.includes(tag) &&
      tag.toLowerCase().includes(tagInput.toLowerCase())
    );
  }, [allTags, selectedTags, tagInput]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const matchesTags = selectedTags.length === 0 || selectedTags.every(t => ex.tags.includes(t));
      return matchesTags;
    });
  }, [exercises, selectedTags]);

  const tree = useMemo(() => {
    const organized = organizeByCourse(filteredExercises);
    return Object.entries(organized).map(([courseName, weeks]) => ({
      name: courseName,
      weeks
    }));
  }, [filteredExercises]);

  // Auto-expand weeks when filtering
  useEffect(() => {
    if (selectedTags.length > 0 || tagInput.trim() !== '') {
      // Expand all weeks when filtering
      const allWeekKeys = new Set<string>();
      tree.forEach(courseNode => {
        if (courseNode.name === selectedCourse) {
          Object.keys(courseNode.weeks).forEach(weekNum => {
            allWeekKeys.add(`${courseNode.name}-w${weekNum}`);
          });
        }
      });
      setExpandedWeeks(allWeekKeys);
    }
  }, [selectedTags, tagInput, tree, selectedCourse]);

  const toggleWeek = (key: string) => {
    const next = new Set(expandedWeeks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedWeeks(next);
  };

  const addTag = (tag: string) => {
    setSelectedTags(prev => [...prev, tag]);
    setTagInput("");
    setIsTagDropdownOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const removeTagFromExercise = (tag: string) => {
    if (!selectedExercise) return;
    const updatedTags = selectedExercise.tags.filter(t => t !== tag);
    const updatedExercise = { ...selectedExercise, tags: updatedTags };
    setSelectedExercise(updatedExercise);
    // TODO: Save to database
  };

  const addTagToExercise = (tag: string) => {
    if (!selectedExercise || selectedExercise.tags.includes(tag)) return;
    const updatedTags = [...selectedExercise.tags, tag];
    const updatedExercise = { ...selectedExercise, tags: updatedTags };
    setSelectedExercise(updatedExercise);
    // TODO: Save to database
  };

  const handleDeleteExercise = async () => {
    if (!selectedExercise) return;
    const updatedExercises = await deleteExercise(selectedExercise.id);
    setExercises(updatedExercises);
    setSelectedExercise(null);
    setShowDeleteExerciseDialog(false);
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    const updatedExercises = await deleteCourse(courseToDelete);
    setExercises(updatedExercises);
    if (selectedCourse === courseToDelete) {
      setSelectedCourse(null);
      setSelectedExercise(null);
    }
    setShowDeleteCourseDialog(false);
    setCourseToDelete(null);
  };

  // Get the currently selected course node
  const selectedCourseNode = tree.find(node => node.name === selectedCourse);

  // Get all unique courses
  const allCourses = tree.map(node => node.name);

  return (
    <div className="flex h-full w-full bg-white dark:bg-neutral-950">
      {/* Left Sidebar: Week Tree */}
      <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-neutral-900/30">

        {/* Filter Area */}
        <div className="p-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10">

          {/* Tag Autocomplete Input */}
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              ref={tagInputRef}
              type="text"
              placeholder="Filter tags..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:bg-white dark:focus:bg-neutral-900 focus:border-neutral-300 dark:focus:border-neutral-700 focus:ring-0 rounded-lg text-sm transition-all dark:text-neutral-200"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setIsTagDropdownOpen(true);
              }}
              onFocus={() => setIsTagDropdownOpen(true)}
            />

            {/* Dropdown */}
            {isTagDropdownOpen && availableTags.length > 0 && (
              <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                {availableTags.map(tag => (
                  <div
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-2"
                  >
                    <Hash size={12} className="opacity-50" />
                    {tag}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Tag Chips */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium animate-in fade-in zoom-in duration-200"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-300 focus:outline-none"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 underline ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Week Tree View (only for selected course) */}
        <div className="flex-1 overflow-y-auto p-2">
          {!selectedCourse && (
            <div className="p-8 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
              <Filter size={24} className="opacity-20" />
              Select a course to view exercises.
            </div>
          )}

          {selectedCourse && selectedCourseNode && (
            <div>
              {/* Course Header with Delete Button */}
              <div className="flex items-center justify-between p-3 mb-2 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Folder size={16} className="text-neutral-500" />
                  <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{selectedCourse}</span>
                </div>
                <button
                  onClick={() => {
                    setCourseToDelete(selectedCourse);
                    setShowDeleteCourseDialog(true);
                  }}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors group"
                  title="Delete course"
                >
                  <Trash2 size={14} className="text-neutral-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                </button>
              </div>

              {/* Weeks */}
              {Object.entries(selectedCourseNode.weeks).length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                  <Filter size={24} className="opacity-20" />
                  No exercises found for this course.
                </div>
              ) : (
                Object.entries(selectedCourseNode.weeks).map(([weekNum, weekExercises]) => {
                  const weekKey = `${selectedCourse}-w${weekNum}`;
                  return (
                    <div key={weekKey} className="mb-1">
                      <div
                        className="flex items-center gap-2 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer select-none text-sm text-neutral-600 dark:text-neutral-400 transition-colors"
                        onClick={() => toggleWeek(weekKey)}
                      >
                        {expandedWeeks.has(weekKey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="font-medium">Week {weekNum}</span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 rounded-full border dark:border-neutral-700">{weekExercises.length}</span>
                      </div>

                      {expandedWeeks.has(weekKey) && (
                        <div className="ml-6 space-y-0.5 mt-1 mb-2">
                          {weekExercises.map(ex => (
                            <div
                              key={ex.id}
                              onClick={() => setSelectedExercise(ex)}
                              className={`flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer transition-colors ${selectedExercise?.id === ex.id
                                  ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-300'
                                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                                }`}
                            >
                              <FileText size={16} className={selectedExercise?.id === ex.id ? "text-blue-500" : "text-neutral-400"} />
                              <span className="truncate">{ex.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Exercise Details */}
      <div className="flex-1 bg-white dark:bg-neutral-950 flex flex-col h-full overflow-hidden">
        {selectedExercise ? (
          <div className="h-full flex flex-col overflow-y-auto">
            <div className="p-8 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {selectedExercise.tags.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-wide">
                      {selectedExercise.tags[0]}
                    </span>
                  )}
                  <span className="text-neutral-400 text-sm">
                    {selectedExercise.course} / Week {selectedExercise.week}
                  </span>
                </div>
                <button
                  onClick={() => setShowDeleteExerciseDialog(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete exercise"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>

              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6">{selectedExercise.name}</h1>

              {/* Editable Tags */}
              <div className="mb-8">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 block">TAGS</label>
                <div className="flex flex-wrap gap-2">
                  {selectedExercise.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => removeTagFromExercise(tag)}
                      className="group flex items-center gap-0 hover:gap-1 text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800"
                      title="Click to remove"
                    >
                      <Hash size={12} className="mr-1" />
                      <span className="whitespace-nowrap">{tag}</span>
                      <X size={12} className="opacity-0 group-hover:opacity-100 w-0 group-hover:w-3 transition-all ml-1" />
                    </button>
                  ))}

                  {/* Add Tag Input */}
                  <input
                    type="text"
                    placeholder="+ Add tag"
                    className="text-sm bg-transparent border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-1.5 w-24 focus:w-32 focus:border-blue-400 focus:ring-0 focus:outline-none transition-all placeholder:text-neutral-400 dark:text-neutral-300"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          addTagToExercise(val);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {selectedExercise.imageUri ? (
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm bg-neutral-50 dark:bg-neutral-900 p-4 mb-8">
                  <img
                    src={getImageUrl(selectedExercise.imageUri)}
                    alt={selectedExercise.name}
                    className="w-full h-auto object-contain max-h-[600px]"
                  />
                </div>
              ) : (
                <div className="p-12 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-neutral-400 mb-8">
                  No visual extraction available.
                </div>
              )}

              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <h3 className="text-lg font-semibold mb-2 text-neutral-900 dark:text-white">Notes</h3>
                <textarea
                  className="w-full p-4 border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-500 focus:outline-none min-h-[100px] text-sm resize-y"
                  placeholder="Add your solution or notes here..."
                ></textarea>
              </div>
            </div>
          </div>
        ) : (
          // Empty state - no exercise selected
          <div className="flex items-center justify-center h-full text-neutral-400">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">Select an exercise to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Exercise Confirmation Dialog */}
      {showDeleteExerciseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Delete Exercise</h2>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Are you sure you want to delete "<strong>{selectedExercise?.name}</strong>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteExerciseDialog(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExercise}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Dialog */}
      {showDeleteCourseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Delete Course</h2>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Are you sure you want to delete "<strong>{courseToDelete}</strong>" and all its exercises? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteCourseDialog(false);
                  setCourseToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
