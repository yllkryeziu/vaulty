import React, { useState, KeyboardEvent } from 'react';
import type { Exercise } from '../types';
import { EditIcon } from './icons/EditIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { PlusIcon } from './icons/PlusIcon';
import { cn } from '../lib/utils';

interface ExerciseEditorProps {
  courseName: string;
  week: number;
  exercises: Exercise[];
  selectedExerciseId: string | null;
  onSelectionChange: (id: string | null) => void;
  onDataChange: (data: { courseName: string; exercises: Exercise[] }) => void;
  onWeekChange: (week: number) => void;
}

export const ExerciseEditor: React.FC<ExerciseEditorProps> = ({
  courseName,
  week,
  exercises,
  selectedExerciseId,
  onSelectionChange,
  onDataChange,
  onWeekChange,
}) => {
  const [editingCourseName, setEditingCourseName] = useState<boolean>(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  const [editingTag, setEditingTag] = useState<{ exerciseId: string; tagIndex: number } | null>(null);
  const [newTagValues, setNewTagValues] = useState<{ [exerciseId: string]: string }>({});
  const [addingTagToExerciseId, setAddingTagToExerciseId] = useState<string | null>(null);


  const handleCourseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDataChange({ courseName: e.target.value, exercises });
  };

  const handleExerciseNameChange = (id: string, value: string) => {
    const updatedExercises = exercises.map((ex) => {
      if (ex.id === id) {
        return { ...ex, name: value };
      }
      return ex;
    });
    onDataChange({ courseName, exercises: updatedExercises });
  };
  
  const handleItemClick = (id: string) => {
    onSelectionChange(id);
    setEditingExerciseId(null);
  };
  
  const handleTagEdit = (exerciseId: string, tagIndex: number, newValue: string) => {
    const updatedExercises = exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newTags = [...ex.tags];
        newTags[tagIndex] = newValue;
        return { ...ex, tags: newTags };
      }
      return ex;
    });
    onDataChange({ courseName, exercises: updatedExercises });
  };

  const handleRemoveTag = (exerciseId: string, tagIndex: number) => {
    const updatedExercises = exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newTags = ex.tags.filter((_, i) => i !== tagIndex);
        return { ...ex, tags: newTags };
      }
      return ex;
    });
    onDataChange({ courseName, exercises: updatedExercises });
  };

  const handleAddTag = (exerciseId: string) => {
    const tagToAdd = newTagValues[exerciseId]?.trim();
    if (!tagToAdd) {
        setAddingTagToExerciseId(null);
        return;
    };

    const updatedExercises = exercises.map(ex => {
      if (ex.id === exerciseId && !ex.tags.includes(tagToAdd)) {
        return { ...ex, tags: [...ex.tags, tagToAdd] };
      }
      return ex;
    });
    onDataChange({ courseName, exercises: updatedExercises });
    setNewTagValues(prev => ({ ...prev, [exerciseId]: '' }));
    setAddingTagToExerciseId(null);
  };

  const handleNewTagChange = (exerciseId: string, value: string) => {
    setNewTagValues(prev => ({ ...prev, [exerciseId]: value }));
  };


  const renderExercise = (ex: Exercise) => {
      const isSelected = ex.id === selectedExerciseId;
      const isEditingName = ex.id === editingExerciseId;
      
      return (
        <div
          key={ex.id}
          onClick={() => handleItemClick(ex.id)}
          className={cn(
            'p-3 rounded-lg cursor-pointer transition-all duration-200 border',
            isSelected ? 'bg-neutral-800 border-neutral-700' : 'bg-transparent border-transparent hover:bg-neutral-900'
          )}
        >
          <div className="flex justify-between items-start gap-2">
            {isEditingName ? (
              <input
                type="text"
                value={ex.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={() => setEditingExerciseId(null)}
                onChange={(e) => handleExerciseNameChange(ex.id, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingExerciseId(null)}
                className="bg-neutral-800 text-white w-full font-medium p-1 rounded-md text-sm outline-none"
              />
            ) : (
              <h4 className="font-medium text-white break-words">{ex.name}</h4>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingExerciseId(isEditingName ? null : ex.id);
              }}
              className="text-neutral-500 hover:text-white p-1 rounded-full flex-shrink-0"
            >
              {isEditingName ? <CheckIcon className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />}
            </button>
          </div>
          
            <div className="flex flex-wrap gap-2 mt-2 items-center">
                {ex.tags.map((tag, index) => {
                    const isEditingThisTag = editingTag?.exerciseId === ex.id && editingTag?.tagIndex === index;
                    return (
                        <div key={index} className="group relative flex items-center">
                            {isEditingThisTag ? (
                                <input
                                    type="text"
                                    value={tag}
                                    autoFocus
                                    onBlur={() => setEditingTag(null)}
                                    onChange={(e) => handleTagEdit(ex.id, index, e.target.value)}
                                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setEditingTag(null)}
                                    className="bg-neutral-700 border border-neutral-600 text-xs text-white px-2 py-0.5 rounded-full outline-none w-24"
                                />
                            ) : (
                                <span
                                    onClick={(e) => { e.stopPropagation(); setEditingTag({ exerciseId: ex.id, tagIndex: index }); }}
                                    className="bg-neutral-800 border border-neutral-700/50 text-xs text-neutral-300 px-2 py-0.5 rounded-full cursor-pointer"
                                >
                                    {tag}
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(ex.id, index); }}
                                className="absolute -top-1.5 -right-1.5 bg-neutral-600 hover:bg-red-500 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                aria-label={`Remove tag ${tag}`}
                            >
                                <XIcon className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    );
                })}

                {addingTagToExerciseId === ex.id ? (
                    <div className="flex items-center">
                        <input
                            type="text"
                            placeholder="Add tag..."
                            value={newTagValues[ex.id] || ''}
                            autoFocus
                            onBlur={() => handleAddTag(ex.id)}
                            onChange={(e) => handleNewTagChange(ex.id, e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') handleAddTag(ex.id);
                                if (e.key === 'Escape') setAddingTagToExerciseId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-neutral-700 border border-neutral-600 text-xs text-white px-2 py-0.5 rounded-full outline-none w-24"
                        />
                    </div>
                ) : (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setAddingTagToExerciseId(ex.id);
                        }} 
                        className="flex items-center gap-1 bg-transparent border border-transparent text-xs text-neutral-500 hover:text-white px-1 py-0.5 rounded-full transition-colors"
                        aria-label="Add new tag"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

          {ex.boundingBox && (
             <div className="mt-2 text-xs text-green-400 flex items-center gap-1.5 font-medium">
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Box Drawn</span>
             </div>
          )}
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full text-sm">
        <div className="mb-6 grid grid-cols-5 gap-6">
            <div className="col-span-3">
                <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Course Name</label>
                <div className="flex items-center gap-2">
                    {editingCourseName ? (
                        <input
                            type="text"
                            value={courseName}
                            autoFocus
                            onBlur={() => setEditingCourseName(false)}
                            onChange={handleCourseNameChange}
                            className="w-full bg-neutral-900 text-white p-2 rounded-md border border-neutral-700 focus:ring-1 focus:ring-white focus:border-white outline-none"
                        />
                    ) : (
                        <p className="text-lg font-semibold text-white w-full p-2 rounded-md truncate">{courseName}</p>
                    )}
                    <button
                        onClick={() => setEditingCourseName(!editingCourseName)}
                        className="text-neutral-400 hover:text-white p-2 rounded-md hover:bg-neutral-800 flex-shrink-0"
                    >
                        {editingCourseName ? <CheckIcon /> : <EditIcon />}
                    </button>
                </div>
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Week</label>
                <div className="relative">
                    <select
                        value={week}
                        onChange={(e) => onWeekChange(parseInt(e.target.value))}
                        className="w-full bg-neutral-900 text-white p-2 rounded-md border border-neutral-700 focus:ring-1 focus:ring-white focus:border-white outline-none appearance-none text-lg font-semibold"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a3a3a3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.5rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '2.5rem',
                        }}
                    >
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                            <option key={w} value={w} className="bg-neutral-800 text-white font-semibold">Week {w}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
      
      <h3 className="text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wider">Exercises</h3>
      <div className="space-y-2 overflow-y-auto pr-2 flex-grow -mr-6">
        {exercises.length > 0 ? exercises.map(renderExercise) : <p className="text-neutral-500 text-center py-8">No exercises extracted.</p>}
      </div>
    </div>
  );
};