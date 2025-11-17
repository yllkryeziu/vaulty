import React, { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { PdfViewer } from './components/PdfViewer';
import { ExerciseEditor } from './components/ExerciseEditor';
import { Spinner } from './components/Spinner';
import { Sidebar } from './components/ui/NavBar';
import { Settings } from './components/Settings';
import { DatabaseView } from './components/DatabaseView';
import { FirstRunSetup } from './components/FirstRunSetup';
import type { ExtractedData, Exercise, BoundingBox, DatabaseState } from './types';
import { convertPdfToImages } from './utils/pdfUtils';
import { extractExercisesFromImages } from './services/geminiService';
import { invoke } from '@tauri-apps/api/core';

type View = 'extraction' | 'database' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('extraction');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [database, setDatabase] = useState<DatabaseState | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);

  useEffect(() => {
    checkFirstRun();
    loadDatabase();
  }, []);

  const checkFirstRun = async () => {
    try {
      const apiKey = await invoke<string | null>('get_api_key');
      // If no API key exists in database, show first-run setup
      if (apiKey === null) {
        setShowFirstRunSetup(true);
      }
    } catch (error) {
      console.error("Failed to check first run status:", error);
    }
  };

  const loadDatabase = async () => {
    try {
      const dbData = await invoke<DatabaseState>('get_all_courses');
      setDatabase(dbData);
    } catch (error) {
      console.error("Failed to load database:", error);
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setPdfFile(file);
    setError(null);
    setExtractedData(null);
    setPdfPages([]);
    setExercises([]);
    setSelectedExerciseId(null);
    
    try {
      setIsLoading(true);

      setLoadingMessage('Converting PDF to images...');
      const images = await convertPdfToImages(file);
      setPdfPages(images);

      setLoadingMessage('Asking Gemini to extract exercises...');
      const data = await extractExercisesFromImages(images);
      
      const exercisesWithIds = data.exercises.map(ex => ({ ...ex, id: crypto.randomUUID(), boundingBox: null, image: null }));
      setExtractedData({ courseName: data.courseName, week: 1 });
      setExercises(exercisesWithIds);
      if (exercisesWithIds.length > 0) {
        setSelectedExerciseId(exercisesWithIds[0].id);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleBoxDrawn = useCallback((exerciseId: string, pageIndex: number, box: BoundingBox) => {
    setExercises(prevExercises =>
      prevExercises.map(ex =>
        ex.id === exerciseId ? { ...ex, boundingBox: { ...box, pageIndex } } : ex
      )
    );
  }, []);

  const handleDataChange = (updatedData: { courseName: string; exercises: Exercise[] }) => {
    setExtractedData(prev => prev ? { ...prev, courseName: updatedData.courseName } : { courseName: updatedData.courseName });
    setExercises(updatedData.exercises);
  };

  const handleWeekChange = (week: number) => {
    setExtractedData(prev => prev ? { ...prev, week } : null);
  };
  
  const handleExport = async () => {
    if (!extractedData || !extractedData.week) return;

    setIsLoading(true);
    setLoadingMessage('Generating cropped images and exporting...');

    try {
      const exercisesWithImages: Exercise[] = [];

      for (const exercise of exercises) {
        if (exercise.boundingBox) {
          const pageImageSrc = pdfPages[exercise.boundingBox.pageIndex];
          const croppedImage = await cropImage(pageImageSrc, exercise.boundingBox);

          // Save image to file system via Tauri
          const type = exercise.tags[0]?.replace(/\s+/g, '_').toLowerCase() || 'exercise';
          const exerciseName = `week${extractedData.week}_${type}_${exercises.indexOf(exercise) + 1}`;
          const imagePath = await invoke<string>('save_image', {
            imageData: croppedImage,
            exerciseName: exerciseName
          });

          exercisesWithImages.push({ ...exercise, image: imagePath });
        } else {
          exercisesWithImages.push({ ...exercise, image: null });
        }
      }

      // Prepare exercises data for database
      const finalExercises = exercisesWithImages.map((ex, index) => {
        const type = ex.tags[0]?.replace(/\s+/g, '_').toLowerCase() || 'exercise';
        const newName = `week${extractedData.week}_${type}_${index + 1}`;
        return {
          name: newName,
          tags: ex.tags,
          image: ex.image
        };
      });

      // Save to Tauri database
      await invoke('save_week_data', {
        courseName: extractedData.courseName,
        weekNumber: extractedData.week,
        exercises: finalExercises
      });

      // Reload database to reflect changes
      await loadDatabase();

      // Also create JSON download (keeping original functionality)
      const exportData = {
        courseName: extractedData.courseName,
        week: extractedData.week,
        exercises: finalExercises
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${extractedData.courseName.replace(/\s+/g, '_')}_week${extractedData.week}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to export data:", error);
      const errorMessage = error instanceof Error ? error.message : "Could not save data to the database.";
      setError(`Export failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const cropImage = (imageSrc: string, box: BoundingBox): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const scaleX = img.naturalWidth / box.pageWidth;
            const scaleY = img.naturalHeight / box.pageHeight;

            canvas.width = box.width * scaleX;
            canvas.height = box.height * scaleY;

            ctx.drawImage(
                img,
                box.x * scaleX,
                box.y * scaleY,
                box.width * scaleX,
                box.height * scaleY,
                0, 0,
                canvas.width, canvas.height
            );
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageSrc;
    });
  };

  const allBoxesDrawn = exercises.length > 0 && exercises.every(ex => ex.boundingBox);

  const renderExtractionView = () => (
    <>
       {!pdfFile && (
        <div className="flex flex-col items-center justify-center h-full">
            <header className="text-center mb-8">
                <h1 className="text-5xl font-bold text-white tracking-tight">VAULTY</h1>
                <p className="text-neutral-400 mt-3 max-w-xl">
                    Upload a PDF textbook or worksheet, and let AI extract the exercises for you.
                    Draw bounding boxes to crop and export structured data effortlessly.
                </p>
            </header>
            <FileUpload onFileChange={handleFileChange} />
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center h-full"><Spinner message={loadingMessage} /></div>}
      
      {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg my-4 max-w-2xl mx-auto">
              <p className="font-bold">An error occurred:</p>
              <p>{error}</p>
          </div>
      )}

      {extractedData && pdfPages.length > 0 && !isLoading && (
        <div className="flex flex-col h-full">
            <header className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-900">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Extraction Workbench</h1>
                    <p className="text-neutral-400">Review the extracted data and draw boxes around exercises.</p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={!allBoxesDrawn}
                    className="bg-white text-black font-semibold py-2 px-5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-black"
                >
                    {allBoxesDrawn ? 'Save & Export' : 'Draw all boxes to export'}
                </button>
            </header>
            <main className="grid grid-cols-2 gap-6 flex-1 min-h-0">
              <div className="bg-neutral-950/50 rounded-lg overflow-hidden">
                  <PdfViewer
                    pages={pdfPages}
                    exercises={exercises}
                    selectedExerciseId={selectedExerciseId}
                    onBoxDrawn={handleBoxDrawn}
                  />
              </div>
              <div className="bg-neutral-950/50 rounded-lg p-6 flex flex-col min-h-0">
                <ExerciseEditor
                  courseName={extractedData.courseName}
                  week={extractedData.week ?? 1}
                  exercises={exercises}
                  selectedExerciseId={selectedExerciseId}
                  onSelectionChange={setSelectedExerciseId}
                  onDataChange={handleDataChange}
                  onWeekChange={handleWeekChange}
                />
              </div>
            </main>
        </div>
      )}
    </>
  );
  
  const renderDatabaseView = () => (
    <DatabaseView database={database} onDataChange={loadDatabase} />
  );

  const renderSettingsView = () => (
    <Settings />
  );

  const renderActiveView = () => {
    switch (view) {
      case 'extraction':
        return renderExtractionView();
      case 'database':
        return renderDatabaseView();
      case 'settings':
        return renderSettingsView();
      default:
        return renderExtractionView();
    }
  }

  return (
    <>
      {showFirstRunSetup && (
        <FirstRunSetup onComplete={() => setShowFirstRunSetup(false)} />
      )}
      <div className="flex h-screen bg-black">
        <Sidebar activeView={view} onViewChange={setView} />
        <div className="flex-1 pl-60">
          <div className="w-full h-full overflow-y-auto p-8">
            {renderActiveView()}
          </div>
        </div>
      </div>
    </>
  );
}