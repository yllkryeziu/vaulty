import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, ChevronDown, Image as ImageIcon, Trash2, Search, X } from 'lucide-react';
import type { DatabaseState } from '../types';
import { cn } from '../lib/utils';
import { invoke } from '@tauri-apps/api/core';

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

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

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

    if (!database || Object.keys(database.courses).length === 0) {
        return (
            <div>
                <header className="mb-6 pb-4 border-b border-neutral-900">
                    <h1 className="text-2xl font-semibold text-white">Database</h1>
                    <p className="text-neutral-400">Browse and manage your extracted exercises.</p>
                </header>
                <div className="text-center py-20 bg-neutral-950/50 rounded-lg border border-neutral-900">
                    <Database size={48} className="mx-auto text-neutral-600" />
                    <h2 className="mt-4 text-xl font-semibold text-white">Database is Empty</h2>
                    <p className="mt-1 text-neutral-400">
                        Go to the 'Extractor' tab, process a PDF, and click 'Save & Export' to add exercises here.
                    </p>
                </div>
            </div>
        );
    }

    const sortedCourses = Object.entries(database.courses).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div>
            <header className="mb-6 pb-4 border-b border-neutral-900">
                <h1 className="text-2xl font-semibold text-white">Database</h1>
                <p className="text-neutral-400">Browse and manage your extracted exercises.</p>
            </header>

            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-950/50 border border-neutral-800 text-white pl-10 pr-10 py-3 rounded-lg focus:ring-2 focus:ring-white focus:border-white outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Tag Filters */}
                {availableTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-neutral-500 self-center">Filter by tags:</span>
                        {availableTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={cn(
                                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                                    selectedTags.includes(tag)
                                        ? "bg-white text-black border-white"
                                        : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500"
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                        {selectedTags.length > 0 && (
                            <button
                                onClick={() => setSelectedTags([])}
                                className="text-xs px-3 py-1.5 rounded-full bg-red-900/50 text-red-300 border border-red-700 hover:bg-red-900"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {sortedCourses.map(([courseName, courseData]) => {
                    const isCourseExpanded = expandedCourses.includes(courseName);
                    const sortedWeeks = Object.entries(courseData.weeks).sort((a, b) => {
                        const weekA = parseInt(a[0].replace('week', ''), 10);
                        const weekB = parseInt(b[0].replace('week', ''), 10);
                        return weekA - weekB;
                    });

                    return (
                        <div key={courseName} className="bg-neutral-950/50 border border-neutral-900 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleCourse(courseName)}
                                className="w-full flex justify-between items-center p-4 text-left hover:bg-neutral-900 transition-colors"
                            >
                                <h2 className="text-lg font-semibold text-white">{courseName}</h2>
                                <ChevronDown
                                    className={cn('text-neutral-500 transition-transform', isCourseExpanded && 'rotate-180')}
                                    size={20}
                                />
                            </button>
                            <AnimatePresence>
                                {isCourseExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-neutral-900 p-4 space-y-3">
                                            {sortedWeeks.map(([weekKey, weekData]) => {
                                                const weekId = `${courseName}-${weekKey}`;
                                                const isWeekExpanded = expandedWeeks.includes(weekId);
                                                const weekNumber = weekKey.replace('week', '');
                                                const filteredExercises = filterExercises(weekData.exercises);

                                                // Don't show week if all exercises are filtered out
                                                if (filteredExercises.length === 0 && (searchQuery || selectedTags.length > 0)) {
                                                    return null;
                                                }

                                                return (
                                                    <div key={weekId} className="bg-neutral-900/70 rounded-md overflow-hidden">
                                                        <button
                                                            onClick={() => toggleWeek(weekId)}
                                                            className="w-full flex justify-between items-center p-3 text-left hover:bg-neutral-800/50 transition-colors"
                                                        >
                                                            <h3 className="font-medium text-neutral-200">
                                                                Week {weekNumber}
                                                                {filteredExercises.length !== weekData.exercises.length && (
                                                                    <span className="ml-2 text-xs text-neutral-500">
                                                                        ({filteredExercises.length} of {weekData.exercises.length})
                                                                    </span>
                                                                )}
                                                            </h3>
                                                            <ChevronDown
                                                                className={cn('text-neutral-500 transition-transform', isWeekExpanded && 'rotate-180')}
                                                                size={18}
                                                            />
                                                        </button>
                                                        <AnimatePresence>
                                                            {isWeekExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="border-t border-neutral-800/50 p-4">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                            {filteredExercises.map(exercise => (
                                                                                <ExerciseCard
                                                                                    key={exercise.name}
                                                                                    exercise={exercise}
                                                                                    onDelete={handleDeleteExercise}
                                                                                    loadImage={loadImage}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Separate component for exercise cards to handle image loading
const ExerciseCard: React.FC<{
    exercise: any;
    onDelete: (id: number, name: string) => void;
    loadImage: (path: string | null | undefined) => Promise<string | null>;
}> = ({ exercise, onDelete, loadImage }) => {
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
    }, [exercise.image]);

    return (
        <div className="bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 group relative">
            <div className="aspect-video bg-neutral-900 flex items-center justify-center relative">
                {imageLoading ? (
                    <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
                ) : imageSrc ? (
                    <img src={imageSrc} alt={exercise.name} className="w-full h-full object-contain" />
                ) : (
                    <ImageIcon className="w-10 h-10 text-neutral-700" />
                )}
            </div>
            <div className="p-3">
                <h4 className="text-sm font-semibold text-white truncate">{exercise.name}</h4>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {exercise.tags.map((tag: string) => (
                        <span key={tag} className="bg-neutral-800 border border-neutral-700/50 text-xs text-neutral-300 px-2 py-0.5 rounded-full">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
            {/* Delete button - shows on hover */}
            <button
                onClick={() => exercise.id && onDelete(exercise.id, exercise.name)}
                className="absolute top-2 right-2 bg-red-900/90 hover:bg-red-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete exercise"
            >
                <Trash2 size={16} className="text-white" />
            </button>
        </div>
    );
};
