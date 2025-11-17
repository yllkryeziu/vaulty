import React, { useState, useEffect } from 'react';
import { Database, ChevronRight, Image as ImageIcon, Trash2, Search, X, FileText, Folder, FolderOpen } from 'lucide-react';
import type { DatabaseState } from '../types';
import { cn } from '../lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface Exercise {
    id?: number;
    name: string;
    tags: string[];
    image: string | null;
}

interface DatabaseViewProps {
    database: DatabaseState | null;
    onDataChange: () => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ database, onDataChange }) => {
    const [expandedCourses, setExpandedCourses] = useState<string[]>([]);
    const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [imageCache, setImageCache] = useState<{ [key: string]: string }>({});
    const [tagInput, setTagInput] = useState('');
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<{
        exercise: Exercise;
        courseName: string;
        weekNumber: string;
    } | null>(null);

    useEffect(() => {
        // Extract all unique tags from database
        if (database) {
            const tags = new Set<string>();
            Object.values(database.courses).forEach(course => {
                Object.values(course.weeks).forEach(week => {
                    week.exercises.forEach(exercise => {
                        exercise.tags.forEach(tag => tags.add(tag));
                    });
                });
            });
            setAvailableTags(Array.from(tags).sort());
        }
    }, [database]);

    const toggleCourse = (courseName: string) => {
        setExpandedCourses(prev =>
            prev.includes(courseName)
                ? prev.filter(c => c !== courseName)
                : [...prev, courseName]
        );
    };

    const toggleWeek = (weekId: string) => {
        setExpandedWeeks(prev =>
            prev.includes(weekId)
                ? prev.filter(w => w !== weekId)
                : [...prev, weekId]
        );
    };

    const addTag = (tag: string) => {
        if (tag && !selectedTags.includes(tag)) {
            setSelectedTags(prev => [...prev, tag]);
            setTagInput('');
            setShowTagSuggestions(false);
        }
    };

    const removeTag = (tag: string) => {
        setSelectedTags(prev => prev.filter(t => t !== tag));
    };

    const filteredTagSuggestions = availableTags.filter(
        tag =>
            tag.toLowerCase().includes(tagInput.toLowerCase()) &&
            !selectedTags.includes(tag)
    );

    const loadImage = async (imagePath: string | null | undefined): Promise<string | null> => {
        if (!imagePath) return null;

        // Check cache first
        if (imageCache[imagePath]) {
            return imageCache[imagePath];
        }

        try {
            const base64Image = await invoke<string>('get_image_path', { relativePath: imagePath });
            setImageCache(prev => ({ ...prev, [imagePath]: base64Image }));
            return base64Image;
        } catch (error) {
            console.error('Failed to load image:', error);
            return null;
        }
    };

    const handleDeleteExercise = async (exerciseId: number, exerciseName: string) => {
        if (!confirm(`Are you sure you want to delete "${exerciseName}"?`)) {
            return;
        }

        try {
            await invoke('delete_exercise', { exerciseId });
            onDataChange(); // Reload database
        } catch (error) {
            console.error('Failed to delete exercise:', error);
            alert('Failed to delete exercise. Please try again.');
        }
    };

    const filterExercises = (exercises: any[]) => {
        return exercises.filter(exercise => {
            // Filter by search query
            if (searchQuery && !exercise.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }

            // Filter by selected tags
            if (selectedTags.length > 0) {
                const hasMatchingTag = selectedTags.some(selectedTag =>
                    exercise.tags.some((tag: string) => tag.toLowerCase() === selectedTag.toLowerCase())
                );
                if (!hasMatchingTag) return false;
            }

            return true;
        });
    };

    const sortedCourses = database ? Object.entries(database.courses).sort((a, b) => a[0].localeCompare(b[0])) : [];

    const handleExerciseSelect = (exercise: Exercise, courseName: string, weekNumber: string) => {
        setSelectedExercise({ exercise, courseName, weekNumber });
    };

    if (!database || Object.keys(database.courses).length === 0) {
        return (
            <div className="flex h-full">
                <div className="w-64 border-r border-neutral-900 bg-neutral-950/50 p-4">
                    <div className="text-sm text-neutral-500">No courses</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Database size={48} className="mx-auto text-neutral-600" />
                        <h2 className="mt-4 text-xl font-semibold text-white">Database is Empty</h2>
                        <p className="mt-1 text-neutral-400">
                            Go to the Extraction tab, process a PDF, and save exercises.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-neutral-950 text-white">
            {/* Sidebar */}
            <div className="w-80 border-r border-neutral-900 bg-neutral-950/50 flex flex-col">
                {/* Search and Filter in Sidebar */}
                <div className="p-4 border-b border-neutral-900 space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm pl-9 pr-8 py-2 rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Tag Filter Input */}
                    {availableTags.length > 0 && (
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filter by tags..."
                                value={tagInput}
                                onChange={(e) => {
                                    setTagInput(e.target.value);
                                    setShowTagSuggestions(true);
                                }}
                                onFocus={() => setShowTagSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm px-3 py-2 rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none"
                            />

                            {/* Autocomplete Suggestions */}
                            {showTagSuggestions && tagInput && filteredTagSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {filteredTagSuggestions.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => addTag(tag)}
                                            className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected Tags */}
                    {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {selectedTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => removeTag(tag)}
                                    className="group flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white text-black hover:bg-neutral-200 transition-colors"
                                >
                                    <span>{tag}</span>
                                    <X size={12} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* File Tree */}
                <div className="flex-1 overflow-y-auto p-2">
                    {sortedCourses.map(([courseName, courseData]) => {
                        const isCourseExpanded = expandedCourses.includes(courseName);
                        const sortedWeeks = Object.entries(courseData.weeks).sort((a, b) => {
                            const weekA = parseInt(a[0].replace('week', ''), 10);
                            const weekB = parseInt(b[0].replace('week', ''), 10);
                            return weekA - weekB;
                        });

                        return (
                            <div key={courseName}>
                                <button
                                    onClick={() => toggleCourse(courseName)}
                                    className="w-full flex items-center p-2 text-left hover:bg-neutral-900 rounded-md transition-colors"
                                >
                                    {isCourseExpanded ? <FolderOpen size={16} className="mr-2 text-white" /> : <Folder size={16} className="mr-2 text-neutral-400" />}
                                    <span className="font-semibold text-white flex-1">{courseName}</span>
                                    <ChevronRight
                                        className={cn('text-neutral-500 transition-transform', isCourseExpanded && 'rotate-90')}
                                        size={16}
                                    />
                                </button>
                                {isCourseExpanded && (
                                    <div className="pl-4">
                                        {sortedWeeks.map(([weekKey, weekData]) => {
                                            const weekId = `${courseName}-${weekKey}`;
                                            const isWeekExpanded = expandedWeeks.includes(weekId);
                                            const weekNumber = weekKey.replace('week', '');
                                            const filteredExercises = filterExercises(weekData.exercises);

                                            if (filteredExercises.length === 0 && (searchQuery || selectedTags.length > 0)) {
                                                return null;
                                            }

                                            return (
                                                <div key={weekId}>
                                                    <button
                                                        onClick={() => toggleWeek(weekId)}
                                                        className="w-full flex items-center p-2 text-left hover:bg-neutral-900 rounded-md transition-colors"
                                                    >
                                                        {isWeekExpanded ? <FolderOpen size={16} className="mr-2 text-white" /> : <Folder size={16} className="mr-2 text-neutral-400" />}
                                                        <span className="font-medium text-neutral-200 flex-1">Week {weekNumber}</span>
                                                        <ChevronRight
                                                            className={cn('text-neutral-500 transition-transform', isWeekExpanded && 'rotate-90')}
                                                            size={16}
                                                        />
                                                    </button>
                                                    {isWeekExpanded && (
                                                        <div className="pl-4">
                                                            {filteredExercises.map(exercise => (
                                                                <button
                                                                    key={exercise.id}
                                                                    onClick={() => handleExerciseSelect(exercise, courseName, weekNumber)}
                                                                    className={cn(
                                                                        "w-full flex items-center p-2 text-left hover:bg-neutral-900 rounded-md transition-colors text-sm",
                                                                        selectedExercise?.exercise.id === exercise.id ? "bg-neutral-800 text-white" : "text-neutral-400"
                                                                    )}
                                                                >
                                                                    <FileText size={14} className="mr-2" />
                                                                    <span>{exercise.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main View */}
            <div className="flex-1">
                {selectedExercise ? (
                    <ExerciseDetailView
                        selectedExercise={selectedExercise}
                        onDelete={handleDeleteExercise}
                        loadImage={loadImage}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                            <Database size={48} className="mx-auto text-neutral-600" />
                            <h2 className="mt-4 text-xl font-semibold text-white">Select an Exercise</h2>
                            <p className="mt-1 text-neutral-400">
                                Choose an exercise from the sidebar to view its details.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ExerciseDetailView: React.FC<{
    selectedExercise: {
        exercise: Exercise;
        courseName: string;
        weekNumber: string;
    };
    onDelete: (id: number, name: string) => void;
    loadImage: (path: string | null | undefined) => Promise<string | null>;
}> = ({ selectedExercise, onDelete, loadImage }) => {
    const { exercise, courseName, weekNumber } = selectedExercise;
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(true);

    useEffect(() => {
        if (exercise.image) {
            setImageLoading(true);
            loadImage(exercise.image).then(src => {
                setImageSrc(src);
                setImageLoading(false);
            });
        } else {
            setImageLoading(false);
        }
    }, [exercise.image, loadImage]);

    if (!exercise) return null;

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm text-neutral-400">{courseName} / Week {weekNumber}</p>
                        <h1 className="text-4xl font-bold text-white mt-1">{exercise.name}</h1>
                    </div>
                    {exercise.id && (
                         <button
                            onClick={() => exercise.id && onDelete(exercise.id, exercise.name)}
                            className="bg-red-900/90 hover:bg-red-800 p-2 rounded-full text-white transition-colors"
                            title="Delete exercise"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4 mb-6">
                    {exercise.tags.map((tag: string) => (
                        <span key={tag} className="bg-neutral-800 border border-neutral-700/50 text-xs text-neutral-300 px-2.5 py-1 rounded-full">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="aspect-video bg-neutral-900 rounded-lg flex items-center justify-center relative border border-neutral-800">
                    {imageLoading ? (
                        <div className="w-10 h-10 border-4 border-neutral-700 border-t-white rounded-full animate-spin" />
                    ) : imageSrc ? (
                        <img src={imageSrc} alt={exercise.name} className="w-full h-full object-contain rounded-lg" />
                    ) : (
                        <div className="text-center text-neutral-500">
                            <ImageIcon className="w-16 h-16 mx-auto" />
                            <p className="mt-2">No image for this exercise</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
