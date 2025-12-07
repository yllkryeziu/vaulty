import { useState, useRef, useCallback, useEffect } from 'react';

interface DrawingRect {
    y: number;
    h: number;
}

export const useCanvasDrawing = (
    imageRef: React.RefObject<HTMLImageElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    selectedExerciseId: string | null,
    onCropComplete: (cropUri: string, boundingBox: { y: number; height: number }) => void
) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [startY, setStartY] = useState(0);
    const [currentRect, setCurrentRect] = useState<DrawingRect | null>(null);

    const getMouseY = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current) return 0;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleY = canvasRef.current.height / rect.height;
        return (e.clientY - rect.top) * scaleY;
    }, [canvasRef]);

    const captureCrop = useCallback((rect: DrawingRect): string => {
        const tempCanvas = document.createElement('canvas');
        const fullWidth = imageRef.current?.naturalWidth || 0;
        tempCanvas.width = fullWidth;
        tempCanvas.height = rect.h;
        const ctx = tempCanvas.getContext('2d');
        if (ctx && imageRef.current) {
            ctx.drawImage(
                imageRef.current,
                0, rect.y, fullWidth, rect.h,
                0, 0, fullWidth, rect.h
            );
        }
        return tempCanvas.toDataURL('image/png');
    }, [imageRef]);

    const startDrawing = useCallback((e: React.MouseEvent) => {
        if (!selectedExerciseId) return;
        const y = getMouseY(e);
        setIsDrawing(true);
        setStartY(y);
        setCurrentRect({ y, h: 0 });
    }, [selectedExerciseId, getMouseY]);

    const draw = useCallback((e: React.MouseEvent) => {
        if (!isDrawing || !currentRect) return;
        const y = getMouseY(e);
        setCurrentRect({
            y: Math.min(startY, y),
            h: Math.abs(y - startY)
        });
    }, [isDrawing, currentRect, startY, getMouseY]);

    const stopDrawing = useCallback(() => {
        if (!isDrawing || !currentRect || !canvasRef.current) return;
        setIsDrawing(false);

        if (selectedExerciseId && imageRef.current) {
            const cropUri = captureCrop(currentRect);
            onCropComplete(cropUri, { y: currentRect.y, height: currentRect.h });
        }
    }, [isDrawing, currentRect, canvasRef, selectedExerciseId, imageRef, captureCrop, onCropComplete]);

    // Sync canvas size to image
    useEffect(() => {
        if (imageRef.current && canvasRef.current) {
            const syncSize = () => {
                if (canvasRef.current && imageRef.current) {
                    canvasRef.current.width = imageRef.current.naturalWidth;
                    canvasRef.current.height = imageRef.current.naturalHeight;
                }
            };
            if (imageRef.current.complete) {
                syncSize();
            } else {
                imageRef.current.onload = syncSize;
            }
        }
    }, [imageRef, canvasRef]);

    return {
        isDrawing,
        currentRect,
        startDrawing,
        draw,
        stopDrawing,
        setCurrentRect
    };
};
