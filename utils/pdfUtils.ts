
// This requires the pdf.js library to be loaded globally, e.g., from a CDN.
declare const pdfjsLib: any;

export async function convertPdfToImages(file: File): Promise<string[]> {
  const images: string[] = [];
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error('Failed to read file'));
      }
      
      const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
      
      try {
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if(!context) {
              return reject(new Error('Could not get canvas context'));
          }

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;
          images.push(canvas.toDataURL('image/jpeg'));
        }

        resolve(images);
      } catch (error) {
        console.error('Error processing PDF:', error);
        reject(new Error('Could not process the PDF file. It might be corrupted or protected.'));
      }
    };

    fileReader.onerror = () => {
      reject(new Error('Error reading the file.'));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
}
