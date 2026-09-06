"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Layers, LoaderCircle, Type, Upload } from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import FileDropzone from "../../../components/FileDropzone";
import { parsePageRanges } from "../../../lib/pdf/pageRanges";
import { renderPdfThumbnails, type PdfThumbnail } from "../../../lib/pdf/renderThumbnails";

type WatermarkMode = "text" | "image";
type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

const positions: { id: Position; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255] : [0.5, 0.5, 0.5];
}

function getPositionStyle(position: Position) {
  const isTop = position.startsWith("top");
  const isCenter = position.endsWith("center");
  const isRight = position.endsWith("right");
  return {
    top: isTop ? "15%" : "auto",
    bottom: isTop ? "auto" : "15%",
    left: isCenter ? "50%" : isRight ? "auto" : "15%",
    right: isRight ? "15%" : "auto",
    transform: isCenter ? "translateX(-50%)" : "none",
  };
}

export default function AddWatermarkPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PdfThumbnail | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<WatermarkMode>("text");
  const [textContent, setTextContent] = useState("CONFIDENTIAL");
  const [textFont, setTextFont] = useState<"Helvetica" | "TimesRoman">("Helvetica");
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState("#999999");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageScale, setImageScale] = useState(25);
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [applyToAll, setApplyToAll] = useState(true);
  const [pageRange, setPageRange] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => () => {
    if (preview?.imageUrl) URL.revokeObjectURL(preview.imageUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl, preview]);

  const loadPdf = async (file: File) => {
    setSourceFile(file);
    setPreview(null);
    setPageCount(0);
    setPageRange("");
    setRangeError("");
    setError("");
    setDownloadUrl("");
    setIsRendering(true);
    try {
      const thumbnails = await renderPdfThumbnails(file);
      if (thumbnails.length === 0) throw new Error("Empty PDF");
      setPreview(thumbnails[0]);
      setPageCount(thumbnails.length);
    } catch {
      setSourceFile(null);
      setError("We could not read this PDF. It may be corrupted, encrypted, empty, or password-protected.");
    } finally {
      setIsRendering(false);
    }
  };

  const onImageSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5 MB.");
      return;
    }
    setError("");
    setImageFile(file);
  };

  const updatePageRange = (value: string) => {
    setPageRange(value);
    const result = parsePageRanges(value, pageCount);
    setRangeError(result.error);
    if (!result.error) setError("");
  };

  const applyWatermark = async () => {
    if (!sourceFile || pageCount === 0) return;
    if (mode === "text" && !textContent.trim()) {
      setError("Please enter text for the watermark.");
      return;
    }
    if (mode === "image" && !imageFile) {
      setError("Please upload an image for the watermark.");
      return;
    }
    const selectedPages = applyToAll ? Array.from({ length: pageCount }, (_, index) => index + 1) : parsePageRanges(pageRange, pageCount).pages;
    if (selectedPages.length === 0 || rangeError) return;
    setIsApplying(true);
    setError("");
    try {
      const pdf = await PDFDocument.load(await sourceFile.arrayBuffer());
      const opacityFactor = opacity / 100;
      const isTop = position.startsWith("top");
      const isCenter = position.endsWith("center");
      const isRight = position.endsWith("right");

      if (mode === "text") {
        const fontKey = StandardFonts[textFont];
        const font = await pdf.embedFont(fontKey);
        const [r, g, b] = hexToRgb(textColor);
        selectedPages.forEach((pageNumber) => {
          const page = pdf.getPage(pageNumber - 1);
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(textContent, textSize);
          const margin = textSize * 1.5;
          const x = isCenter ? (width - textWidth) / 2 : isRight ? width - margin - textWidth : margin;
          const y = isTop ? height - margin : margin;
          page.drawText(textContent, {
            x,
            y,
            size: textSize,
            font,
            color: rgb(r * opacityFactor + (1 - opacityFactor), g * opacityFactor + (1 - opacityFactor), b * opacityFactor + (1 - opacityFactor)),
            rotate: degrees(rotation),
          });
        });
      } else if (mode === "image" && imageFile) {
        const imageBytes = await imageFile.arrayBuffer();
        let embeddedImage;
        if (imageFile.type === "image/png") {
          embeddedImage = await pdf.embedPng(imageBytes);
        } else if (imageFile.type === "image/jpeg") {
          embeddedImage = await pdf.embedJpg(imageBytes);
        } else {
          throw new Error("Only PNG and JPG images are supported.");
        }

        selectedPages.forEach((pageNumber) => {
          const page = pdf.getPage(pageNumber - 1);
          const { width, height } = page.getSize();
          const scale = imageScale / 100;
          const imgWidth = width * scale;
          const imgHeight = (embeddedImage.height / embeddedImage.width) * imgWidth;
          const margin = width * 0.1;
          const x = isCenter ? (width - imgWidth) / 2 : isRight ? width - margin - imgWidth : margin;
          const y = isTop ? height - margin - imgHeight : margin;
          page.drawImage(embeddedImage, {
            x,
            y,
            width: imgWidth,
            height: imgHeight,
            opacity: opacityFactor,
            rotate: degrees(rotation),
          });
        });
      }

      const bytes = await pdf.save();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      setDownloadUrl(URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not add the watermark. The PDF may be corrupted or password-protected.");
    } finally {
      setIsApplying(false);
    }
  };

  const startOver = () => {
    if (preview?.imageUrl) URL.revokeObjectURL(preview.imageUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setSourceFile(null);
    setPreview(null);
    setPageCount(0);
    setPageRange("");
    setRangeError("");
    setError("");
    setDownloadUrl("");
    setImageFile(null);
  };

  const canApply = (mode === "text" && textContent.trim()) || (mode === "image" && imageFile);

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content watermark-content">
        <div className="tool-page-heading"><span className="tool-page-icon watermark-icon"><FileText size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>Add Watermark</h1><p>Protect or brand your document with text or an image.</p></div></div>
        <section className="merge-panel" aria-label="Add watermark tool">
          {!sourceFile && <FileDropzone onFilesSelected={(files) => { if (files[0]) loadPdf(files[0]); }} multiple={false} label="Drop your PDF here" description="or click to choose one file" />}
          {isRendering && <div className="loading-state"><LoaderCircle className="spinner" size={20} /> Rendering page preview...</div>}
          {sourceFile && !isRendering && preview && <div className="watermark-workspace">
            <div className="watermark-preview-column"><div className="split-file-bar"><div><strong>{sourceFile.name}</strong><span>{pageCount} pages</span></div><button className="text-button" type="button" onClick={startOver}>Choose another</button></div><div className="watermark-preview"><img src={preview.imageUrl} alt="First page preview" /><div className="watermark-demo" style={{ ...getPositionStyle(position), opacity: opacity / 100, transform: `rotate(${rotation}deg)` }}>{mode === "text" ? <span style={{ fontSize: `${Math.min(textSize, 24)}px`, color: textColor }}>{textContent}</span> : imageFile ? <span style={{ fontSize: "12px", color: "#666" }}>Image preview</span> : null}</div></div></div>
            <div className="watermark-options">
              <div className="watermark-mode-toggle"><button className={mode === "text" ? "mode-toggle mode-toggle--active" : "mode-toggle"} type="button" onClick={() => setMode("text")}><Type size={16} /> Text</button><button className={mode === "image" ? "mode-toggle mode-toggle--active" : "mode-toggle"} type="button" onClick={() => setMode("image")}><Upload size={16} /> Image</button></div>
              {mode === "text" && <>
                <div className="option-group"><label className="option-label" htmlFor="text-content">Watermark text</label><input id="text-content" type="text" className="text-input" value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="e.g. CONFIDENTIAL" /></div>
                <div className="option-group"><label className="option-label" htmlFor="text-font">Font</label><select id="text-font" className="number-select" value={textFont} onChange={(event) => setTextFont(event.target.value as "Helvetica" | "TimesRoman")}><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times New Roman</option></select></div>
                <div className="option-group"><label className="option-label" htmlFor="text-size">Font size</label><input id="text-size" type="number" min="8" max="120" className="number-input" value={textSize} onChange={(event) => setTextSize(Math.min(120, Math.max(8, Number(event.target.value) || 8)))} /></div>
                <div className="option-group"><label className="option-label" htmlFor="text-color">Color</label><input id="text-color" type="color" className="color-input" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></div>
              </>}
              {mode === "image" && <>
                <div className="image-upload-section"><label className="option-label">Upload image (PNG or JPG, max 5 MB)</label><input type="file" className="file-input-hidden" accept="image/png,image/jpeg" onChange={(event) => onImageSelected(Array.from(event.target.files || []))} /><div className="image-upload-button" onClick={(event) => { (event.currentTarget.querySelector(".file-input-hidden") as HTMLInputElement)?.click(); }}><Upload size={20} /> {imageFile ? imageFile.name : "Choose an image"}</div></div>
                <div className="option-group"><label className="option-label" htmlFor="image-scale">Scale (% of page width)</label><input id="image-scale" type="number" min="5" max="100" className="number-input" value={imageScale} onChange={(event) => setImageScale(Math.min(100, Math.max(5, Number(event.target.value) || 25)))} /></div>
              </>}
              <div className="option-group"><label className="option-label" htmlFor="opacity-slider">Opacity: {opacity}%</label><input id="opacity-slider" type="range" min="0" max="100" className="slider" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} aria-label="Watermark opacity" /></div>
              <div className="option-group"><label className="option-label" htmlFor="rotation-input">Rotation: {rotation}°</label><input id="rotation-input" type="number" className="number-input" value={rotation} onChange={(event) => setRotation(Number(event.target.value) % 360)} min="0" max="359" aria-label="Watermark rotation" /></div>
              <div className="option-group"><span className="option-label">Position</span><div className="position-picker">{positions.map((item) => <button className={position === item.id ? "position-option position-option--active" : "position-option"} type="button" key={item.id} onClick={() => setPosition(item.id)} aria-label={item.label} aria-pressed={position === item.id}><span /></button>)}</div></div>
              <div className="option-group"><span className="option-label">Apply to</span><div className="range-toggle"><button className={applyToAll ? "range-toggle-option range-toggle-option--active" : "range-toggle-option"} type="button" onClick={() => { setApplyToAll(true); setRangeError(""); }}>All pages</button><button className={!applyToAll ? "range-toggle-option range-toggle-option--active" : "range-toggle-option"} type="button" onClick={() => setApplyToAll(false)}>Page range</button></div>{!applyToAll && <><input className="number-input range-input" type="text" value={pageRange} onChange={(event) => updatePageRange(event.target.value)} placeholder="1-3, 5, 8-10" aria-label="Page range" aria-invalid={Boolean(rangeError)} />{rangeError && <p className="inline-error" role="alert">{rangeError}</p>}</>}</div>
            </div>
          </div>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {downloadUrl && <div className="success-message" role="status">Your watermarked PDF is ready to download.</div>}
          {sourceFile && !isRendering && <div className="merge-actions">{downloadUrl ? <a className="primary-action" href={downloadUrl} download="watermarked.pdf"><Check size={17} /> Download watermarked PDF</a> : <button className="primary-action" type="button" disabled={Boolean(rangeError) || !canApply || isApplying || (!applyToAll && !pageRange.trim())} onClick={applyWatermark}>{isApplying && <LoaderCircle className="spinner" size={18} />}{isApplying ? "Applying watermark..." : "Apply watermark"}</button>}<button className="secondary-action" type="button" onClick={startOver}>Start over</button></div>}
        </section>
      </main>
    </div>
  );
}
