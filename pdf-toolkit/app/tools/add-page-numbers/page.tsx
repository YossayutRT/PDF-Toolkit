"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Layers, LoaderCircle } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import FileDropzone from "../../../components/FileDropzone";
import { parsePageRanges } from "../../../lib/pdf/pageRanges";
import { renderPdfThumbnails, type PdfThumbnail } from "../../../lib/pdf/renderThumbnails";

type NumberPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
type NumberFormat = "number" | "fraction" | "page" | "page-of";

const positions: { id: NumberPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

function getPreviewText(format: NumberFormat, number: number, totalPages: number) {
  if (format === "fraction") return `${number} / ${totalPages}`;
  if (format === "page") return `Page ${number}`;
  if (format === "page-of") return `Page ${number} of ${totalPages}`;
  return `${number}`;
}

function getPositionStyle(position: NumberPosition) {
  const isTop = position.startsWith("top");
  const isCenter = position.endsWith("center");
  const isRight = position.endsWith("right");
  return {
    top: isTop ? "9%" : "auto",
    bottom: isTop ? "auto" : "9%",
    left: isCenter ? "50%" : isRight ? "auto" : "9%",
    right: isRight ? "9%" : "auto",
    transform: isCenter ? "translateX(-50%)" : "none",
  };
}

export default function AddPageNumbersPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PdfThumbnail | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [format, setFormat] = useState<NumberFormat>("number");
  const [startingNumber, setStartingNumber] = useState(1);
  const [fontSize, setFontSize] = useState(11);
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

  const updatePageRange = (value: string) => {
    setPageRange(value);
    const result = parsePageRanges(value, pageCount);
    setRangeError(result.error);
    if (!result.error) setError("");
  };

  const applyNumbers = async () => {
    if (!sourceFile || pageCount === 0) return;
    const selectedPages = applyToAll ? Array.from({ length: pageCount }, (_, index) => index + 1) : parsePageRanges(pageRange, pageCount).pages;
    if (selectedPages.length === 0 || rangeError) return;
    setIsApplying(true);
    setError("");
    try {
      const pdf = await PDFDocument.load(await sourceFile.arrayBuffer());
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      selectedPages.forEach((pageNumber, index) => {
        const page = pdf.getPage(pageNumber - 1);
        const text = getPreviewText(format, startingNumber + index, pageCount);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const margin = Math.max(18, fontSize * 1.5);
        const isTop = position.startsWith("top");
        const isCenter = position.endsWith("center");
        const isRight = position.endsWith("right");
        const x = isCenter ? (width - textWidth) / 2 : isRight ? width - margin - textWidth : margin;
        const y = isTop ? height - margin - fontSize : margin;
        page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.18, 0.2, 0.19) });
      });
      const bytes = await pdf.save();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      setDownloadUrl(URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })));
    } catch {
      setError("We could not add page numbers. The PDF may be corrupted or password-protected.");
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
  };

  const previewNumber = startingNumber;
  const previewText = getPreviewText(format, previewNumber, pageCount || 1);

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content page-numbers-content">
        <div className="tool-page-heading"><span className="tool-page-icon page-numbers-icon"><FileText size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>Add Page Numbers</h1><p>Give every page a clear place in the story.</p></div></div>
        <section className="merge-panel" aria-label="Add page numbers tool">
          {!sourceFile && <FileDropzone onFilesSelected={(files) => { if (files[0]) loadPdf(files[0]); }} multiple={false} label="Drop your PDF here" description="or click to choose one file" />}
          {isRendering && <div className="loading-state"><LoaderCircle className="spinner" size={20} /> Rendering page preview...</div>}
          {sourceFile && !isRendering && preview && <div className="page-number-workspace">
            <div className="number-preview-column"><div className="split-file-bar"><div><strong>{sourceFile.name}</strong><span>{pageCount} pages</span></div><button className="text-button" type="button" onClick={startOver}>Choose another</button></div><div className="number-preview"><img src={preview.imageUrl} alt="First page preview" /><span className="preview-number" style={getPositionStyle(position)}>{previewText}</span></div><p className="live-preview-label">Live preview: <strong>{previewText}</strong></p></div>
            <div className="number-options">
              <div className="option-group"><span className="option-label">Position</span><div className="position-picker">{positions.map((item) => <button className={position === item.id ? "position-option position-option--active" : "position-option"} type="button" key={item.id} onClick={() => setPosition(item.id)} aria-label={item.label} aria-pressed={position === item.id}><span /></button>)}</div></div>
              <div className="option-group"><label className="option-label" htmlFor="number-format">Format</label><select id="number-format" className="number-select" value={format} onChange={(event) => setFormat(event.target.value as NumberFormat)}><option value="number">1</option><option value="fraction">1 / N</option><option value="page">Page 1</option><option value="page-of">Page 1 of N</option></select></div>
              <div className="compact-options"><div className="option-group"><label className="option-label" htmlFor="starting-number">Starting number</label><input className="number-input" id="starting-number" type="number" min="1" value={startingNumber} onChange={(event) => setStartingNumber(Math.max(1, Number(event.target.value) || 1))} /></div><div className="option-group"><label className="option-label" htmlFor="font-size">Font size (pt)</label><input className="number-input" id="font-size" type="number" min="6" max="72" value={fontSize} onChange={(event) => setFontSize(Math.min(72, Math.max(6, Number(event.target.value) || 6)))} /></div></div>
              <div className="option-group"><span className="option-label">Apply to</span><div className="range-toggle"><button className={applyToAll ? "range-toggle-option range-toggle-option--active" : "range-toggle-option"} type="button" onClick={() => { setApplyToAll(true); setRangeError(""); }}>All pages</button><button className={!applyToAll ? "range-toggle-option range-toggle-option--active" : "range-toggle-option"} type="button" onClick={() => setApplyToAll(false)}>Page range</button></div>{!applyToAll && <><input className="number-input range-input" type="text" value={pageRange} onChange={(event) => updatePageRange(event.target.value)} placeholder="1-3, 5, 8-10" aria-label="Page range" aria-invalid={Boolean(rangeError)} />{rangeError && <p className="inline-error" role="alert">{rangeError}</p>}</>}</div>
            </div>
          </div>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {downloadUrl && <div className="success-message" role="status">Your numbered PDF is ready to download.</div>}
          {sourceFile && !isRendering && <div className="merge-actions">{downloadUrl ? <a className="primary-action" href={downloadUrl} download="numbered-pages.pdf"><Check size={17} /> Download numbered PDF</a> : <button className="primary-action" type="button" disabled={Boolean(rangeError) || isApplying || (!applyToAll && !pageRange.trim())} onClick={applyNumbers}>{isApplying && <LoaderCircle className="spinner" size={18} />}{isApplying ? "Applying numbers..." : "Apply page numbers"}</button>}<button className="secondary-action" type="button" onClick={startOver}>Start over</button></div>}
        </section>
      </main>
    </div>
  );
}