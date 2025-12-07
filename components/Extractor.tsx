import React, { useState, useRef, useEffect, useContext } from 'react';
import { Upload, Check, AlertCircle, Wand2, X } from 'lucide-react';
import { Button } from './Button';
import { ApiKeyContext } from '../App.tsx';
import { analyzePageImage } from '../services/geminiService';
import { Exercise } from '../types';
import { saveExercises, saveImage } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/api/dialog';
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri';

export const Extractor = () => {
  const { apiKey } = useContext(ApiKeyContext);
  const navigate = useNavigate();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedExercises, setExtractedExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [pageCourse, setPageCourse] = useState<string>("My Course"); // Course name for the entire page
  const [pageWeek, setPageWeek] = useState<number>(1); // Week number for the entire page

  // PDF State
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [originalImagePath, setOriginalImagePath] = useState<string | null>(null);

  // Canvas refs
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentRect, setCurrentRect] = useState<{ y: number, h: number } | null>(null);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Documents',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf']
        }]
      });

      if (typeof selected === 'string') {
        handleFileSelection(selected);
      }
    } catch (err) {
      console.error("Failed to open dialog", err);
    }
  };

  const handleFileSelection = async (path: string) => {
    setExtractedExercises([]);
    setSelectedExerciseId(null);
    setCurrentRect(null);
    setPdfPath(null);
    setOriginalImagePath(null);
    setImageUri(null);
    setPdfImages([]);

    if (path.toLowerCase().endsWith('.pdf')) {
      setPdfPath(path);
      try {
        const images = await invoke<string[]>("pdf_to_images", { path });
        setPdfImages(images);

        // Stitch all PDF pages together vertically
        await stitchPdfPages(images);
      } catch (e) {
        console.error("PDF conversion error:", e);
        alert("Failed to convert PDF: " + JSON.stringify(e));
      }
    } else {
      setOriginalImagePath(path);
      setImageUri(convertFileSrc(path));
    }
  };

  const [pdfImages, setPdfImages] = useState<string[]>([]);

  // Stitch PDF pages vertically into one continuous image
  const stitchPdfPages = async (images: string[]) => {
    if (images.length === 0) {
      return;
    }

    // Load all images first
    const loadedImages = await Promise.all(
      images.map((src, index) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve(img);
          };
          img.onerror = (err) => {
            console.error('[STITCH] Image', index, 'failed to load:', err);
            reject(err);
          };
          img.src = src;
        });
      })
    );


    // Create a canvas to stitch all pages together
    const stitchCanvas = document.createElement('canvas');
    const ctx = stitchCanvas.getContext('2d');
    if (!ctx) {
      console.error('[STITCH] Failed to get canvas context');
      return;
    }

    // Calculate total height and max width
    const maxWidth = Math.max(...loadedImages.map(img => img.width));
    const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);

    stitchCanvas.width = maxWidth;
    stitchCanvas.height = totalHeight;

    // Draw each page vertically
    let currentY = 0;
    for (const img of loadedImages) {
      ctx.drawImage(img, 0, currentY, img.width, img.height);
      currentY += img.height;
    }

    // Convert to data URL and set as the main image
    const stitchedDataUrl = stitchCanvas.toDataURL('image/png');
    setImageUri(stitchedDataUrl);
  };

  const handleAnalyze = async () => {

    if (!apiKey) {
      return;
    }

    // Use the current displayed image (stitched PDF or regular image)
    const currentImage = imageUri;
    if (!currentImage) {
      return;
    }

    setIsAnalyzing(true);
    try {
      let results;
      if (originalImagePath && !pdfPath) {
        // Analyzing uploaded image file (not PDF)
        results = await analyzePageImage(null, originalImagePath, apiKey);
      } else if (currentImage) {
        // Analyzing PDF (stitched) or data URI image
        results = await analyzePageImage(currentImage, null, apiKey);
      } else {
        throw new Error("No image to analyze");
      }


      // Add full image URI, course, and week to each result
      const fullResults = results.map(r => ({
        ...r,
        pageImageUri: currentImage,
        course: pageCourse,
        week: pageWeek
      })) as Exercise[];
      setExtractedExercises(fullResults);
    } catch (error) {
      console.error("[ANALYZE] Analysis error:", error);
      alert(`Analysis failed: ${error instanceof Error ? error.message : "Please check your API Key and try again."}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Drawing Logic - Full width, only control height
  const getMouseY = (e: React.MouseEvent) => {
    if (!canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleY = canvasRef.current.height / rect.height;
    return (e.clientY - rect.top) * scaleY;
  };

  const startDrawing = (e: React.MouseEvent) => {
    if (!selectedExerciseId) return;
    const y = getMouseY(e);
    setIsDrawing(true);
    setStartY(y);
    setCurrentRect({ y, h: 0 });
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !currentRect) return;
    const y = getMouseY(e);
    setCurrentRect({
      y: Math.min(startY, y),
      h: Math.abs(y - startY)
    });
  };

  const stopDrawing = () => {
    if (!isDrawing || !currentRect || !canvasRef.current) return;
    setIsDrawing(false);

    // Auto-save crop to the selected exercise
    if (selectedExerciseId && imageRef.current) {
      const cropUri = captureCrop(currentRect);
      setExtractedExercises(prev => prev.map(ex =>
        ex.id === selectedExerciseId
          ? { ...ex, imageUri: cropUri, boundingBox: { y: currentRect.y, height: currentRect.h } }
          : ex
      ));
    }
  };

  const captureCrop = (rect: { y: number, h: number }) => {
    const tempCanvas = document.createElement('canvas');
    const fullWidth = imageRef.current?.naturalWidth || 0;

    // Minimum height for a crop (add white padding if too thin)
    const MIN_HEIGHT = 150;
    const actualHeight = rect.h;
    const needsPadding = actualHeight < MIN_HEIGHT;
    const paddingTotal = needsPadding ? MIN_HEIGHT - actualHeight : 0;
    const paddingTop = Math.floor(paddingTotal / 2);
    const paddingBottom = paddingTotal - paddingTop;
    const finalHeight = needsPadding ? MIN_HEIGHT : actualHeight;

    tempCanvas.width = fullWidth;
    tempCanvas.height = finalHeight;
    const ctx = tempCanvas.getContext('2d');

    if (ctx && imageRef.current) {
      // Fill with white background first (for padding)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, fullWidth, finalHeight);

      // Draw the cropped image (centered if padding was added)
      ctx.drawImage(
        imageRef.current,
        0, rect.y, fullWidth, actualHeight,  // Source: from original image
        0, paddingTop, fullWidth, actualHeight  // Destination: with padding offset
      );
    }
    return tempCanvas.toDataURL('image/png');
  };

  // Update canvas size to match image
  useEffect(() => {

    if (imageRef.current && canvasRef.current) {
      // Wait for image load
      const syncSize = () => {
        if (canvasRef.current && imageRef.current) {
          canvasRef.current.width = imageRef.current.naturalWidth;
          canvasRef.current.height = imageRef.current.naturalHeight;
        }
      }
      if (imageRef.current.complete) {
        syncSize();
      } else {
        imageRef.current.onload = syncSize;
      }
    }
  }, [imageUri]);

  // Log button states
  useEffect(() => {
  }, [imageUri, pdfImages, isAnalyzing, extractedExercises]);

  // Draw selection rect on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all existing bounding boxes subtly (full width)
      extractedExercises.forEach(ex => {
        if (ex.boundingBox && ex.id !== selectedExerciseId) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // Light blue
          ctx.fillRect(0, ex.boundingBox.y, canvas.width, ex.boundingBox.height);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, ex.boundingBox.y, canvas.width, ex.boundingBox.height);
        }
      });

      // Draw current active rect (full width)
      if (currentRect) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(0, currentRect.y, canvas.width, currentRect.h);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, currentRect.y, canvas.width, currentRect.h);
      }
    }
  }, [currentRect, extractedExercises, selectedExerciseId]);


  const handleSaveAll = async () => {

    const valid = extractedExercises.filter(ex => ex.imageUri); // Only save ones with crops

    if (valid.length === 0) {
      return;
    }

    // Save images to disk
    let pageImagePath = "";

    if (imageUri && imageUri.startsWith('data:')) {
      try {
        pageImagePath = await saveImage(imageUri);
      } catch (e) {
        console.error("[SAVE] Failed to save page image", e);
      }
    }

    const exercisesToSave = await Promise.all(valid.map(async (ex, index) => {
      let cropPath = ex.imageUri;
      if (ex.imageUri && ex.imageUri.startsWith('data:')) {
        try {
          cropPath = await saveImage(ex.imageUri);
        } catch (e) {
          console.error("[SAVE] Failed to save crop", e);
        }
      }

      // Only use the new page image path if we saved one, otherwise keep existing if any (unlikely in this flow)
      const finalPageImg = pageImagePath || ex.pageImageUri;

      return {
        ...ex,
        imageUri: cropPath,
        pageImageUri: finalPageImg
      };
    }));


    try {
      await saveExercises(exercisesToSave);
      navigate('/database');
    } catch (e) {
      console.error('[SAVE] Failed to save exercises:', e);
      alert('Failed to save exercises: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 p-8 text-center">
        <AlertCircle size={48} className="text-neutral-400" />
        <h2 className="text-xl font-semibold dark:text-white">API Key Required</h2>
        <p className="text-neutral-500 max-w-md dark:text-neutral-400">
          To use the AI extractor, please configure your Gemini API Key in the Settings menu.
        </p>
        <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      {/* Left: Viewer */}
      <div className="flex-1 bg-neutral-200/50 dark:bg-neutral-950/50 relative overflow-y-auto flex flex-col items-center p-8 gap-6">
        {!imageUri && pdfImages.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 p-12 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 text-center border-dashed border-2 my-auto">
            <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Upload Document</h3>
            <p className="text-neutral-500 mt-1 mb-6 text-sm dark:text-neutral-400">Select a PDF or image to extract exercises from<br /><span className="text-xs">(PDF, PNG, JPG, JPEG, WebP)</span></p>
            <Button onClick={handleSelectFile}>
              Select File
            </Button>
          </div>
        ) : (
          <>
            {/* Close button at top */}
            <div className="w-full max-w-4xl flex justify-end sticky top-0 z-10">
              <Button variant="secondary" size="sm" onClick={() => {
                setImageUri(null);
                setExtractedExercises([]);
                setPdfPath(null);
                setOriginalImagePath(null);
                setPdfImages([]);
              }}>
                <X size={16} className="mr-1" /> Close
              </Button>
            </div>

            {/* Display continuous stitched image */}
            {imageUri && (
              <div className="relative shadow-2xl rounded-lg overflow-visible bg-white dark:bg-neutral-900 max-w-4xl w-full">
                <img
                  ref={imageRef}
                  src={imageUri}
                  alt="Document"
                  className="w-full h-auto object-contain"
                  style={{ display: 'block', maxHeight: 'none' }}
                  onLoad={() => {
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute top-0 left-0 w-full h-full ${selectedExerciseId ? 'cursor-crosshair' : 'cursor-default'}`}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Editor Sidebar */}
      <div className="w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col h-full shadow-xl z-10">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-lg text-neutral-900 dark:text-white">Exercises</h2>
            {(imageUri || pdfImages.length > 0) && (
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                icon={isAnalyzing ? <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <Wand2 size={14} />}
              >
                {isAnalyzing ? 'Analyzing...' : 'AI Extract'}
              </Button>
            )}
          </div>
          {(imageUri || pdfImages.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600 dark:text-neutral-400 w-16">Course:</label>
                <input
                  type="text"
                  value={pageCourse}
                  placeholder="Course name"
                  onChange={(e) => {
                    const newCourse = e.target.value;
                    setPageCourse(newCourse);
                    // Update all existing exercises with new course
                    setExtractedExercises(prev => prev.map(ex => ({ ...ex, course: newCourse })));
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600 dark:text-neutral-400 w-16">Week:</label>
                <input
                  type="number"
                  min="1"
                  value={pageWeek}
                  onChange={(e) => {
                    const newWeek = parseInt(e.target.value) || 1;
                    setPageWeek(newWeek);
                    // Update all existing exercises with new week
                    setExtractedExercises(prev => prev.map(ex => ({ ...ex, week: newWeek })));
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {extractedExercises.length === 0 && (imageUri || pdfImages.length > 0) && !isAnalyzing && (
            <div className="text-neutral-400 text-sm text-center mt-10">
              Click "AI Extract" to identify exercises,<br />or add one manually.
            </div>
          )}

          {(imageUri || pdfImages.length > 0) && (
            <Button variant="secondary" size="sm" className="w-full mb-3" onClick={() => {
              setExtractedExercises([...extractedExercises, {
                id: crypto.randomUUID(),
                name: "New Exercise",
                tags: [],
                course: pageCourse,
                week: pageWeek,
                createdAt: Date.now()
              }]);
            }}>+ Add Exercise Manually</Button>
          )}

          {extractedExercises.map((ex) => (
            <div
              key={ex.id}
              onClick={() => setSelectedExerciseId(ex.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedExerciseId === ex.id
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-900/20 dark:border-blue-500'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:hover:border-neutral-600'
                }`}
            >
              <div className="flex justify-between items-start mb-3">
                <input
                  className="font-medium text-neutral-900 bg-transparent focus:outline-none w-full dark:text-neutral-100"
                  value={ex.name}
                  placeholder="Exercise name"
                  onChange={(e) => {
                    setExtractedExercises(prev => prev.map(item => item.id === ex.id ? { ...item, name: e.target.value } : item));
                  }}
                />
                {ex.imageUri && <div className="text-green-600 dark:text-green-400 ml-2 flex-shrink-0"><Check size={16} /></div>}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ex.tags.map((tag, i) => (
                  <button
                    key={`${tag}-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExtractedExercises(prev => prev.map(item =>
                        item.id === ex.id
                          ? { ...item, tags: item.tags.filter((_, idx) => idx !== i) }
                          : item
                      ));
                    }}
                    className="group flex items-center gap-0 hover:gap-1 text-[10px] bg-neutral-50 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800"
                    title="Click to remove"
                  >
                    <span className="whitespace-nowrap">{tag}</span>
                    <X size={8} className="opacity-0 group-hover:opacity-100 w-0 group-hover:w-2 transition-all" />
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="+ Tag"
                  className="text-[10px] bg-transparent border border-dashed border-neutral-300 rounded-full px-2 py-0.5 w-14 focus:w-20 focus:border-blue-400 focus:ring-0 focus:outline-none transition-all placeholder:text-neutral-400 dark:border-neutral-600 dark:text-neutral-300"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val && !ex.tags.includes(val)) {
                        setExtractedExercises(prev => prev.map(item =>
                          item.id === ex.id
                            ? { ...item, tags: [...item.tags, val] }
                            : item
                        ));
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>

              {selectedExerciseId === ex.id && !ex.imageUri && (
                <div className="mt-2 text-xs text-blue-600 bg-blue-100/50 p-2 rounded dark:bg-blue-900/30 dark:text-blue-300">
                  Drag vertically on the image to select the exercise height (full width).
                </div>
              )}
              {selectedExerciseId === ex.id && ex.imageUri && (
                <div className="mt-2">
                  <img src={ex.imageUri} alt="Crop" className="h-12 object-contain border rounded bg-white dark:bg-neutral-800 dark:border-neutral-700" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <Button
            className="w-full"
            onClick={handleSaveAll}
            disabled={extractedExercises.filter(e => e.imageUri).length === 0}
          >
            Save {extractedExercises.filter(e => e.imageUri).length} to Database
          </Button>
        </div>
      </div>
    </div>
  );
};