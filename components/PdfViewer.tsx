
import React, { useState, useRef, useEffect } from 'react';
import type { Exercise, BoundingBox } from '../types';
import { cn } from '../lib/utils';

interface PdfViewerProps {
  pages: string[];
  exercises: Exercise[];
  selectedExerciseId: string | null;
  onBoxDrawn: (exerciseId: string, pageIndex: number, box: BoundingBox) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pages, exercises, selectedExerciseId, onBoxDrawn }) => {
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<Omit<BoundingBox, 'pageIndex' | 'pageWidth' | 'pageHeight'> | null>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    containerRefs.current = containerRefs.current.slice(0, pages.length);
  }, [pages]);

  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!selectedExerciseId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getRelativeCoords(e);
    setDrawing(true);
    setStartPoint({ y: coords.y });
    setCurrentBox({ x: 0, y: coords.y, width: rect.width, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing || !startPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getRelativeCoords(e);
    setCurrentBox({
      x: 0,
      y: Math.min(startPoint.y, coords.y),
      width: rect.width,
      height: Math.abs(coords.y - startPoint.y),
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!drawing || !currentBox || !selectedExerciseId) return;
    setDrawing(false);
    const rect = e.currentTarget.getBoundingClientRect();
    const finalBox = { ...currentBox, pageIndex, pageWidth: rect.width, pageHeight: rect.height };
    onBoxDrawn(selectedExerciseId, pageIndex, finalBox);
    setStartPoint(null);
    setCurrentBox(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-black p-2 space-y-4">
      {pages.map((page, index) => (
        <div
          key={index}
          ref={el => { containerRefs.current[index] = el; }}
          className="relative w-full shadow-lg"
          style={{ cursor: selectedExerciseId ? 'crosshair' : 'default' }}
          onMouseDown={e => handleMouseDown(e, index)}
          onMouseMove={handleMouseMove}
          onMouseUp={e => handleMouseUp(e, index)}
          onMouseLeave={e => drawing && handleMouseUp(e, index)}
        >
          <img src={page} alt={`Page ${index + 1}`} className="w-full h-auto rounded-sm" />
          
          {exercises.map((ex) =>
            ex.boundingBox && ex.boundingBox.pageIndex === index && (
              <div
                key={ex.id}
                className={cn(
                    'absolute border-2 box-border transition-all rounded-sm',
                    ex.id === selectedExerciseId
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-neutral-500 bg-neutral-500/10'
                )}
                style={{
                  left: ex.boundingBox.x,
                  top: ex.boundingBox.y,
                  width: ex.boundingBox.width,
                  height: ex.boundingBox.height,
                }}
              >
                 <span className={cn(
                    'absolute top-0 left-0 text-xs px-2 py-0.5 rounded-br-md font-semibold',
                    ex.id === selectedExerciseId
                        ? 'bg-blue-500 text-white'
                        : 'bg-neutral-500 text-white'
                )}>
                    {ex.name}
                </span>
              </div>
            )
          )}

          {drawing && currentBox && (
            <div
              className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 rounded-sm"
              style={{
                left: currentBox.x,
                top: currentBox.y,
                width: currentBox.width,
                height: currentBox.height,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
