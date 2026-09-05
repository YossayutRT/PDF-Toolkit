import * as pdfjsLib from "pdfjs-dist";

export type PdfThumbnail = {
  pageNumber: number;
  imageUrl: string;
};

export async function renderPdfThumbnails(file: File, scale = 0.22): Promise<PdfThumbnail[]> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const thumbnails: PdfThumbnail[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) throw new Error("Canvas is not available");
    await page.render({ canvas, canvasContext, viewport }).promise;
    thumbnails.push({ pageNumber, imageUrl: canvas.toDataURL("image/jpeg", 0.82) });
  }

  return thumbnails;
}