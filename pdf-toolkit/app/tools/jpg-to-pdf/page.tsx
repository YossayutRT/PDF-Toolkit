"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, LoaderCircle, Trash2, Check, FileImage } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import FileDropzone from "../../../components/FileDropzone";

type ImageFile = { id: string; file: File; imageUrl: string };
type PageSize = "fit" | "a4" | "letter";
type Orientation = "auto" | "portrait" | "landscape";
type Margin = "none" | "small";

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const MARGIN_SMALL = 20;

async function convertWebpToPng(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not create canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert WEBP to PNG"));
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Failed to load image dimensions"));
    img.src = imageUrl;
  });
}

export default function JpgToPdfPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [margin, setMargin] = useState<Margin>("none");
  const [isConverting, setIsConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => () => {
    images.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [images, downloadUrl]);

  const addImages = async (newFiles: File[]) => {
    setError("");
    setDownloadUrl("");
    const validImages: ImageFile[] = [];
    for (const file of newFiles) {
      if (images.length + validImages.length >= 30) break;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPG, PNG, and WEBP images are supported.");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("Images must be 20 MB or less.");
        continue;
      }
      try {
        let imageUrl: string;
        if (file.type === "image/webp") {
          const pngBlob = await convertWebpToPng(file);
          imageUrl = URL.createObjectURL(pngBlob);
        } else {
          imageUrl = URL.createObjectURL(file);
        }
        validImages.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          imageUrl,
        });
      } catch (err) {
        setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    setImages((current) => [...current, ...validImages]);
  };

  const moveImage = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setImages((current) => {
      const sourceIndex = current.findIndex(({ id }) => id === sourceId);
      const targetIndex = current.findIndex(({ id }) => id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const convertToPdf = async () => {
    if (images.length === 0) return;
    setIsConverting(true);
    setConvertProgress(0);
    setError("");
    try {
      const pdf = await PDFDocument.create();
      const marginValue = margin === "none" ? 0 : MARGIN_SMALL;

      for (let i = 0; i < images.length; i++) {
        const { file, imageUrl } = images[i];
        setConvertProgress(Math.round((i / images.length) * 100));

        let imageData: ArrayBuffer;
        if (file.type === "image/webp") {
          const pngBlob = await convertWebpToPng(file);
          imageData = await pngBlob.arrayBuffer();
        } else {
          imageData = await file.arrayBuffer();
        }

        let embeddedImage;
        if (file.type === "image/jpeg" || file.type === "image/webp") {
          if (file.type === "image/webp") {
            embeddedImage = await pdf.embedPng(imageData);
          } else {
            embeddedImage = await pdf.embedJpg(imageData);
          }
        } else if (file.type === "image/png") {
          embeddedImage = await pdf.embedPng(imageData);
        } else {
          throw new Error(`Unsupported image type: ${file.type}`);
        }

        const dims = await getImageDimensions(imageUrl);
        const imgWidth = dims.width;
        const imgHeight = dims.height;
        const aspectRatio = imgWidth / imgHeight;

        let pageWidth: number;
        let pageHeight: number;

        if (pageSize === "fit") {
          const maxPageWidth = 595;
          const maxPageHeight = 842;
          let scaledWidth = imgWidth;
          let scaledHeight = imgHeight;

          if (scaledWidth > maxPageWidth || scaledHeight > maxPageHeight) {
            const scaleX = maxPageWidth / scaledWidth;
            const scaleY = maxPageHeight / scaledHeight;
            const scale = Math.min(scaleX, scaleY);
            scaledWidth *= scale;
            scaledHeight *= scale;
          }

          pageWidth = scaledWidth + marginValue * 2;
          pageHeight = scaledHeight + marginValue * 2;
        } else {
          const isA4 = pageSize === "a4";
          const baseWidth = isA4 ? A4_WIDTH : LETTER_WIDTH;
          const baseHeight = isA4 ? A4_HEIGHT : LETTER_HEIGHT;

          if (orientation === "auto") {
            if (aspectRatio > 1) {
              pageWidth = Math.max(baseWidth, baseHeight);
              pageHeight = Math.min(baseWidth, baseHeight);
            } else {
              pageWidth = Math.min(baseWidth, baseHeight);
              pageHeight = Math.max(baseWidth, baseHeight);
            }
          } else if (orientation === "landscape") {
            pageWidth = Math.max(baseWidth, baseHeight);
            pageHeight = Math.min(baseWidth, baseHeight);
          } else {
            pageWidth = Math.min(baseWidth, baseHeight);
            pageHeight = Math.max(baseWidth, baseHeight);
          }
        }

        const page = pdf.addPage([pageWidth, pageHeight]);
        const contentWidth = pageWidth - marginValue * 2;
        const contentHeight = pageHeight - marginValue * 2;

        let drawWidth = contentWidth;
        let drawHeight = contentWidth / aspectRatio;

        if (drawHeight > contentHeight) {
          drawHeight = contentHeight;
          drawWidth = contentHeight * aspectRatio;
        }

        const x = marginValue + (contentWidth - drawWidth) / 2;
        const y = marginValue + (contentHeight - drawHeight) / 2;

        page.drawImage(embeddedImage, { x, y, width: drawWidth, height: drawHeight });
      }

      setConvertProgress(100);
      const bytes = await pdf.save();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      setDownloadUrl(URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert images to PDF");
    } finally {
      setIsConverting(false);
      setConvertProgress(0);
    }
  };

  const startOver = () => {
    images.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setImages([]);
    setError("");
    setDownloadUrl("");
    setConvertProgress(0);
  };

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content jpg-to-pdf-content">
        <div className="tool-page-heading"><span className="tool-page-icon jpg-to-pdf-icon"><FileImage size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>JPG to PDF</h1><p>Turn a batch of images into a single PDF file, in order.</p></div></div>
        <section className="merge-panel" aria-label="JPG to PDF tool">
          {images.length === 0 && <FileDropzone onFilesSelected={addImages} multiple={true} accept="image/jpeg,image/png,image/webp" maxSize={20 * 1024 * 1024} label="Drop your images here" description="or click to choose multiple files" />}
          {images.length > 0 && <div className="jpg-to-pdf-workspace">
            <div className="jpg-preview-column">
              <div className="split-file-bar"><div><strong>{images.length} {images.length === 1 ? "image" : "images"} selected</strong><span>Drag to reorder · Click to remove</span></div><button className="text-button" type="button" onClick={() => setImages([])}>Clear all</button></div>
              <div className="image-grid" aria-live="polite">
                {images.map(({ id, imageUrl }, index) => <div className={`image-card ${draggedId === id ? "image-card--dragging" : ""}`} key={id} draggable onDragStart={() => setDraggedId(id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (draggedId) moveImage(draggedId, id); setDraggedId(null); }}>
                  <img src={imageUrl} alt={`Image ${index + 1}`} className="image-thumbnail" />
                  <div className="image-card-footer">
                    <span className="image-number">{index + 1}</span>
                    <button className="remove-image" type="button" onClick={() => setImages((current) => current.filter((item) => item.id !== id))} aria-label={`Remove image ${index + 1}`}><Trash2 size={16} /></button>
                  </div>
                </div>)}
              </div>
            </div>
            <div className="jpg-options-column">
              <div className="option-group">
                <span className="option-label">Page size</span>
                <div className="page-size-buttons">
                  <button className={pageSize === "fit" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setPageSize("fit")}>Fit to image</button>
                  <button className={pageSize === "a4" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setPageSize("a4")}>A4</button>
                  <button className={pageSize === "letter" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setPageSize("letter")}>Letter</button>
                </div>
              </div>
              {pageSize !== "fit" && <div className="option-group">
                <span className="option-label">Orientation</span>
                <div className="orientation-buttons">
                  <button className={orientation === "auto" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setOrientation("auto")}>Auto</button>
                  <button className={orientation === "portrait" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setOrientation("portrait")}>Portrait</button>
                  <button className={orientation === "landscape" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setOrientation("landscape")}>Landscape</button>
                </div>
              </div>}
              <div className="option-group">
                <span className="option-label">Margin</span>
                <div className="margin-buttons">
                  <button className={margin === "none" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setMargin("none")}>None</button>
                  <button className={margin === "small" ? "size-button size-button--active" : "size-button"} type="button" onClick={() => setMargin("small")}>Small</button>
                </div>
              </div>
            </div>
          </div>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {isConverting && <div className="conversion-progress">
            <LoaderCircle className="spinner" size={20} />
            <div><span>Converting images to PDF...</span><span className="progress-percent">{convertProgress}%</span></div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${convertProgress}%` }}></div></div>
          </div>}
          {downloadUrl && <div className="success-message" role="status">Your PDF is ready to download.</div>}
          {images.length > 0 && <div className="merge-actions">
            {downloadUrl ? <a className="primary-action" href={downloadUrl} download="images.pdf"><Check size={17} /> Download PDF</a> : <button className="primary-action" type="button" disabled={isConverting} onClick={convertToPdf}>{isConverting && <LoaderCircle className="spinner" size={18} />}{isConverting ? "Converting..." : "Convert to PDF"}</button>}
            <button className="secondary-action" type="button" onClick={startOver}>Start over</button>
          </div>}
        </section>
      </main>
    </div>
  );
}
