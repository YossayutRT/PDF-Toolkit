"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Layers, LoaderCircle, RotateCw, Trash2 } from "lucide-react";
import { PDFDocument, degrees } from "pdf-lib";
import FileDropzone from "../../../components/FileDropzone";
import { renderPdfThumbnails, type PdfThumbnail } from "../../../lib/pdf/renderThumbnails";

type PageItem = PdfThumbnail & { id: string; rotation: number };
type RemovedPage = { item: PageItem; index: number };

export default function ReorderRotatePages() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [removedPage, setRemovedPage] = useState<RemovedPage | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => () => {
    pages.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl, pages]);

  const loadPdf = async (file: File) => {
    setSourceFile(file);
    setPages([]);
    setRemovedPage(null);
    setError("");
    setDownloadUrl("");
    setIsRendering(true);
    try {
      const thumbnails = await renderPdfThumbnails(file);
      setPages(thumbnails.map((thumbnail) => ({ ...thumbnail, id: `page-${thumbnail.pageNumber}`, rotation: 0 })));
    } catch {
      setSourceFile(null);
      setError("We could not read this PDF. It may be corrupted, encrypted, or password-protected.");
    } finally {
      setIsRendering(false);
    }
  };

  const movePage = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setPages((currentPages) => {
      const sourceIndex = currentPages.findIndex(({ id }) => id === sourceId);
      const targetIndex = currentPages.findIndex(({ id }) => id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return currentPages;
      const nextPages = [...currentPages];
      const [movedPage] = nextPages.splice(sourceIndex, 1);
      nextPages.splice(targetIndex, 0, movedPage);
      return nextPages;
    });
  };

  const moveByStep = (id: string, step: number) => {
    setPages((currentPages) => {
      const index = currentPages.findIndex((page) => page.id === id);
      const targetIndex = index + step;
      if (index < 0 || targetIndex < 0 || targetIndex >= currentPages.length) return currentPages;
      const nextPages = [...currentPages];
      [nextPages[index], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[index]];
      return nextPages;
    });
  };

  const rotatePage = (id: string) => {
    setPages((currentPages) => currentPages.map((page) => page.id === id ? { ...page, rotation: (page.rotation + 90) % 360 } : page));
  };

  const removePage = (id: string) => {
    setPages((currentPages) => {
      const index = currentPages.findIndex((page) => page.id === id);
      if (index < 0) return currentPages;
      setRemovedPage({ item: currentPages[index], index });
      return currentPages.filter((page) => page.id !== id);
    });
    setError("");
  };

  const undoRemove = () => {
    if (!removedPage) return;
    setPages((currentPages) => {
      const nextPages = [...currentPages];
      nextPages.splice(Math.min(removedPage.index, nextPages.length), 0, removedPage.item);
      return nextPages;
    });
    setRemovedPage(null);
  };

  const saveChanges = async () => {
    if (!sourceFile || pages.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const sourcePdf = await PDFDocument.load(await sourceFile.arrayBuffer());
      const outputPdf = await PDFDocument.create();
      for (const page of pages) {
        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [page.pageNumber - 1]);
        copiedPage.setRotation(degrees(page.rotation));
        outputPdf.addPage(copiedPage);
      }
      const bytes = await outputPdf.save();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      setDownloadUrl(URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })));
    } catch {
      setError("We could not save these changes. The PDF may be corrupted or password-protected.");
    } finally {
      setIsSaving(false);
    }
  };

  const startOver = () => {
    pages.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setSourceFile(null);
    setPages([]);
    setRemovedPage(null);
    setError("");
    setDownloadUrl("");
  };

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content reorder-page-content">
        <div className="tool-page-heading"><span className="tool-page-icon reorder-icon"><RotateCw size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>Reorder &amp; Rotate</h1><p>Arrange pages, fix their direction, and remove what you do not need.</p></div></div>
        <section className="merge-panel" aria-label="Reorder and rotate PDF tool">
          {!sourceFile && <FileDropzone onFilesSelected={(files) => { if (files[0]) loadPdf(files[0]); }} multiple={false} label="Drop your PDF here" description="or click to choose one file" />}
          {isRendering && <div className="loading-state"><LoaderCircle className="spinner" size={20} /> Rendering page thumbnails...</div>}
          {sourceFile && !isRendering && <>
            <div className="split-file-bar"><div><strong>{sourceFile.name}</strong><span>{pages.length} pages remaining</span></div><button className="text-button" type="button" onClick={startOver}>Choose another</button></div>
            <p className="reorder-hint">Drag pages to reorder. On touch screens, use the up and down buttons.</p>
            {removedPage && <div className="undo-message" role="status">Page {removedPage.item.pageNumber} removed. <button type="button" onClick={undoRemove}>Undo</button></div>}
            {pages.length > 0 && <div className="reorder-grid" aria-label="PDF page thumbnails">
              {pages.map((page, index) => <div className={`reorder-card ${draggedId === page.id ? "reorder-card--dragging" : ""} ${dropTargetId === page.id ? "reorder-card--drop-target" : ""}`} key={page.id} draggable onDragStart={() => setDraggedId(page.id)} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} onDragOver={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (draggedId !== page.id) setDropTargetId(page.id); }} onDragLeave={() => setDropTargetId(null)} onDrop={(event) => { event.preventDefault(); if (draggedId) movePage(draggedId, page.id); setDraggedId(null); setDropTargetId(null); }}>
                <div className="reorder-preview"><img src={page.imageUrl} alt={`Page ${page.pageNumber}`} style={{ transform: `rotate(${page.rotation}deg)` }} /><span className="page-number">{index + 1}</span><span className="rotation-badge">{page.rotation}°</span></div>
                <div className="reorder-card-footer"><strong>Page {page.pageNumber}</strong><div className="page-actions"><button type="button" onClick={() => moveByStep(page.id, -1)} disabled={index === 0} aria-label={`Move page ${page.pageNumber} up`}><ArrowUp size={14} /></button><button type="button" onClick={() => moveByStep(page.id, 1)} disabled={index === pages.length - 1} aria-label={`Move page ${page.pageNumber} down`}><ArrowDown size={14} /></button><button type="button" onClick={() => rotatePage(page.id)} aria-label={`Rotate page ${page.pageNumber}`}><RotateCw size={14} /></button><button type="button" className="delete-page" onClick={() => removePage(page.id)} aria-label={`Delete page ${page.pageNumber}`}><Trash2 size={14} /></button></div></div>
              </div>)}
            </div>}
          </>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {downloadUrl && <div className="success-message" role="status">Your updated PDF is ready to download.</div>}
          {sourceFile && !isRendering && <div className="merge-actions">{downloadUrl ? <a className="primary-action" href={downloadUrl} download="reordered-pages.pdf"><Check size={17} /> Download updated PDF</a> : <button className="primary-action" type="button" disabled={pages.length === 0 || isSaving} onClick={saveChanges}>{isSaving && <LoaderCircle className="spinner" size={18} />}{isSaving ? "Saving changes..." : "Save changes"}</button>}{(pages.length > 0 || downloadUrl || error) && <button className="secondary-action" type="button" onClick={startOver}>Start over</button>}</div>}
        </section>
      </main>
    </div>
  );
}