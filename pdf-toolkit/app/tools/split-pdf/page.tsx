"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Layers, LoaderCircle, Scissors } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import FileDropzone from "../../../components/FileDropzone";

type Thumbnail = { pageNumber: number; imageUrl: string };
type OutputMode = "single" | "zip";

function parsePageRanges(value: string, pageCount: number) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { pages: [], error: "Choose at least one page." };

  const selectedPages = new Set<number>();
  for (const part of trimmedValue.split(",")) {
    const range = part.trim();
    if (!/^\d+(?:-\d+)?$/.test(range)) {
      return { pages: [], error: "Use a format like 1-3, 5, 8-10." };
    }
    const [startText, endText = startText] = range.split("-");
    const start = Number(startText);
    const end = Number(endText);
    if (start < 1 || end > pageCount || start > end) {
      return { pages: [], error: `Page numbers must be between 1 and ${pageCount}.` };
    }
    for (let page = start; page <= end; page += 1) selectedPages.add(page);
  }

  return { pages: [...selectedPages].sort((a, b) => a - b), error: "" };
}

function pagesToRangeText(pages: number[]) {
  const ranges: string[] = [];
  let rangeStart = pages[0];
  let rangeEnd = pages[0];
  for (const page of pages.slice(1)) {
    if (page === rangeEnd + 1) {
      rangeEnd = page;
    } else {
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = page;
      rangeEnd = page;
    }
  }
  if (rangeStart !== undefined) ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
  return ranges.join(", ");
}

export default function SplitPdfPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeText, setRangeText] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("single");
  const [isRendering, setIsRendering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("");

  useEffect(() => () => {
    thumbnails.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl, thumbnails]);

  const loadPdf = async (file: File) => {
    setSourceFile(file);
    setThumbnails([]);
    setSelectedPages([]);
    setRangeText("");
    setRangeError("");
    setError("");
    setDownloadUrl("");
    setIsRendering(true);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const renderedThumbnails: Thumbnail[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.22 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error("Canvas is not available");
        await page.render({ canvas, canvasContext, viewport }).promise;
        renderedThumbnails.push({ pageNumber, imageUrl: canvas.toDataURL("image/jpeg", 0.82) });
      }
      setThumbnails(renderedThumbnails);
    } catch {
      setError("We could not read this PDF. It may be corrupted, encrypted, or password-protected.");
      setSourceFile(null);
    } finally {
      setIsRendering(false);
    }
  };

  const togglePage = (pageNumber: number) => {
    const nextPages = selectedPages.includes(pageNumber)
      ? selectedPages.filter((page) => page !== pageNumber)
      : [...selectedPages, pageNumber].sort((a, b) => a - b);
    setSelectedPages(nextPages);
    setRangeText(pagesToRangeText(nextPages));
    setRangeError("");
    setError("");
  };

  const updateRange = (value: string) => {
    setRangeText(value);
    const result = parsePageRanges(value, thumbnails.length);
    setRangeError(result.error);
    if (!result.error) {
      setSelectedPages(result.pages);
      setError("");
    }
  };

  const processSplit = async () => {
    if (!sourceFile || selectedPages.length === 0) return;
    setIsProcessing(true);
    setError("");
    try {
      const sourcePdf = await PDFDocument.load(await sourceFile.arrayBuffer());
      let bytes: Uint8Array;
      let fileName: string;
      if (outputMode === "single") {
        const outputPdf = await PDFDocument.create();
        const pages = await outputPdf.copyPages(sourcePdf, selectedPages.map((page) => page - 1));
        pages.forEach((page) => outputPdf.addPage(page));
        bytes = await outputPdf.save();
        fileName = "extracted-pages.pdf";
      } else {
        const zip = new JSZip();
        for (const pageNumber of selectedPages) {
          const outputPdf = await PDFDocument.create();
          const [page] = await outputPdf.copyPages(sourcePdf, [pageNumber - 1]);
          outputPdf.addPage(page);
          zip.file(`page-${pageNumber}.pdf`, await outputPdf.save());
        }
        bytes = await zip.generateAsync({ type: "uint8array" });
        fileName = "extracted-pages.zip";
      }
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      setDownloadUrl(URL.createObjectURL(new Blob([buffer], { type: outputMode === "single" ? "application/pdf" : "application/zip" })));
      setDownloadName(fileName);
    } catch {
      setError("We could not split this PDF. Please check that it is not corrupted or password-protected.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startOver = () => {
    thumbnails.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setSourceFile(null);
    setThumbnails([]);
    setSelectedPages([]);
    setRangeText("");
    setRangeError("");
    setError("");
    setDownloadUrl("");
    setDownloadName("");
  };

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content split-page-content">
        <div className="tool-page-heading"><span className="tool-page-icon split-icon"><Scissors size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>Split PDF</h1><p>Pick the pages you need and leave the rest behind.</p></div></div>
        <section className="merge-panel" aria-label="Split PDF tool">
          {!sourceFile && <FileDropzone onFilesSelected={(files) => { if (files[0]) loadPdf(files[0]); }} multiple={false} label="Drop your PDF here" description="or click to choose one file" />}
          {isRendering && <div className="loading-state"><LoaderCircle className="spinner" size={20} /> Rendering page thumbnails...</div>}
          {sourceFile && !isRendering && <>
            <div className="split-file-bar"><div><strong>{sourceFile.name}</strong><span>{thumbnails.length} pages</span></div><button className="text-button" type="button" onClick={startOver}>Choose another</button></div>
            <div className="range-control"><label htmlFor="page-ranges">Pages to extract</label><input id="page-ranges" type="text" value={rangeText} onChange={(event) => updateRange(event.target.value)} placeholder="e.g. 1-3, 5, 8-10" aria-invalid={Boolean(rangeError)} /><span>Click thumbnails below or type page ranges.</span>{rangeError && <p className="inline-error" role="alert">{rangeError}</p>}</div>
            <div className="thumbnail-grid" aria-label="PDF page thumbnails">
              {thumbnails.map(({ pageNumber, imageUrl }) => { const isSelected = selectedPages.includes(pageNumber); return <button className={`thumbnail-card ${isSelected ? "thumbnail-card--selected" : ""}`} type="button" key={pageNumber} onClick={() => togglePage(pageNumber)} aria-pressed={isSelected}><span className="thumbnail-image"><img src={imageUrl} alt={`Page ${pageNumber}`} />{isSelected && <span className="thumbnail-check"><Check size={14} /></span>}</span><span>Page {pageNumber}</span></button>; })}
            </div>
            <div className="output-control"><span className="control-label">Output format</span><div className="mode-options"><label className={outputMode === "single" ? "mode-option mode-option--active" : "mode-option"}><input type="radio" name="output-mode" value="single" checked={outputMode === "single"} onChange={() => setOutputMode("single")} /><FileText size={16} /><span>Extract as one PDF</span></label><label className={outputMode === "zip" ? "mode-option mode-option--active" : "mode-option"}><input type="radio" name="output-mode" value="zip" checked={outputMode === "zip"} onChange={() => setOutputMode("zip")} /><Layers size={16} /><span>Extract as separate files (ZIP)</span></label></div></div>
          </>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {downloadUrl && <div className="success-message" role="status">Your extracted file is ready to download.</div>}
          {sourceFile && !isRendering && <div className="merge-actions">{downloadUrl ? <a className="primary-action" href={downloadUrl} download={downloadName}>Download {outputMode === "single" ? "PDF" : "ZIP"}</a> : <button className="primary-action" type="button" disabled={selectedPages.length === 0 || Boolean(rangeError) || isProcessing} onClick={processSplit}>{isProcessing && <LoaderCircle className="spinner" size={18} />}{isProcessing ? "Processing..." : "Extract pages"}</button>}{(selectedPages.length > 0 || downloadUrl || error) && <button className="secondary-action" type="button" onClick={startOver}>Start over</button>}</div>}
        </section>
      </main>
    </div>
  );
}