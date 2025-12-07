import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri';

export const usePdfProcessing = () => {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [pdfPath, setPdfPath] = useState<string | null>(null);
    const [originalImagePath, setOriginalImagePath] = useState<string | null>(null);
    const [pdfImages, setPdfImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const stitchPdfPages = useCallback(async (images: string[]) => {
        if (images.length === 0) return;

        const loadedImages = await Promise.all(
            images.map((src) => {
                return new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                });
            })
        );

        const stitchCanvas = document.createElement('canvas');
        const ctx = stitchCanvas.getContext('2d');
        if (!ctx) return;

        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);

        stitchCanvas.width = maxWidth;
        stitchCanvas.height = totalHeight;

        let currentY = 0;
        for (const img of loadedImages) {
            ctx.drawImage(img, 0, currentY, img.width, img.height);
            currentY += img.height;
        }

        const stitchedDataUrl = stitchCanvas.toDataURL('image/png');
        setImageUri(stitchedDataUrl);
    }, []);

    const handleFileSelection = useCallback(async (path: string) => {
        setImageUri(null);
        setPdfPath(null);
        setOriginalImagePath(null);
        setPdfImages([]);
        setIsLoading(true);

        try {
            if (path.toLowerCase().endsWith('.pdf')) {
                setPdfPath(path);
                const images = await invoke<string[]>("pdf_to_images", { path });
                setPdfImages(images);
                await stitchPdfPages(images);
            } else {
                setOriginalImagePath(path);
                setImageUri(convertFileSrc(path));
            }
        } catch (e) {
            throw new Error(`Failed to process file: ${e}`);
        } finally {
            setIsLoading(false);
        }
    }, [stitchPdfPages]);

    const handleSelectFile = useCallback(async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Documents',
                    extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf']
                }]
            });

            if (typeof selected === 'string') {
                await handleFileSelection(selected);
            }
        } catch (err) {
            throw new Error(`Failed to open file dialog: ${err}`);
        }
    }, [handleFileSelection]);

    const reset = useCallback(() => {
        setImageUri(null);
        setPdfPath(null);
        setOriginalImagePath(null);
        setPdfImages([]);
    }, []);

    return {
        imageUri,
        pdfPath,
        originalImagePath,
        pdfImages,
        isLoading,
        handleSelectFile,
        reset,
        setImageUri
    };
};
