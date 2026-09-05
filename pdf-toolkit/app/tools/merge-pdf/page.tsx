"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowLeft, GripVertical, Layers, LoaderCircle, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import FileDropzone from "../../../components/FileDropzone";

type MergeFile = { id: string; file: File };

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MergePdfPage() {
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const addFiles = (newFiles: File[]) => {
    setError("");
    setDownloadUrl("");
    setFiles((currentFiles) => {
      const existingNames = new Set(currentFiles.map(({ file }) => `${file.name}-${file.size}`));
      const additions = newFiles
        .filter((file) => !existingNames.has(`${file.name}-${file.size}`))
        .map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file }));
      return [...currentFiles, ...additions];
    });
  };

  const moveFile = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setFiles((currentFiles) => {
      const sourceIndex = currentFiles.findIndex(({ id }) => id === sourceId);
      const targetIndex = currentFiles.findIndex(({ id }) => id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return currentFiles;
      const nextFiles = [...currentFiles];
      const [movedFile] = nextFiles.splice(sourceIndex, 1);
      nextFiles.splice(targetIndex, 0, movedFile);
      return nextFiles;
    });
  };

  const mergeFiles = async () => {
    setIsMerging(true);
    setError("");
    try {
      const mergedPdf = await PDFDocument.create();
      for (const { file } of files) {
        const sourcePdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const mergedBuffer = new ArrayBuffer(mergedBytes.byteLength);
      new Uint8Array(mergedBuffer).set(mergedBytes);
      const nextUrl = URL.createObjectURL(new Blob([mergedBuffer], { type: "application/pdf" }));
      setDownloadUrl(nextUrl);
    } catch {
      setError("We could not read one of these PDFs. It may be corrupted, encrypted, or password-protected.");
    } finally {
      setIsMerging(false);
    }
  };

  const startOver = () => {
    setFiles([]);
    setError("");
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl("");
  };

  return (
    <div className="app-shell tool-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home"><span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span><span>PDF<span className="brand-accent">Toolkit</span></span></Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to tools</Link>
      </header>
      <main className="tool-page-content">
        <div className="tool-page-heading"><span className="tool-page-icon"><Layers size={24} /></span><div><p className="section-kicker">PDF Toolkit</p><h1>Merge PDF</h1><p>Bring your documents together into one neat file.</p></div></div>
        <section className="merge-panel" aria-label="Merge PDF tool">
          <FileDropzone onFilesSelected={addFiles} label="Drop your PDFs here" description="or click to choose multiple files" />
          {files.length > 0 && <div className="file-list" aria-live="polite">
            <div className="file-list-heading"><h2>{files.length} {files.length === 1 ? "file" : "files"} selected</h2><span>Drag to reorder</span></div>
            {files.map(({ id, file }, index) => <div className={`file-row ${draggedId === id ? "file-row--dragging" : ""}`} key={id} draggable onDragStart={() => setDraggedId(id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (draggedId) moveFile(draggedId, id); setDraggedId(null); }}>
              <GripVertical className="drag-handle" size={18} aria-hidden="true" /><span className="file-number">{index + 1}</span><div className="file-details"><strong>{file.name}</strong><span>{formatFileSize(file.size)}</span></div><button className="remove-file" type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== id))} aria-label={`Remove ${file.name}`}><Trash2 size={17} /></button>
            </div>)}
          </div>}
          {error && <p className="inline-error merge-error" role="alert">{error}</p>}
          {downloadUrl && <div className="success-message" role="status">Your merged PDF is ready to download.</div>}
          <div className="merge-actions">
            {downloadUrl ? <a className="primary-action" href={downloadUrl} download="merged.pdf">Download merged PDF</a> : <button className="primary-action" type="button" disabled={files.length < 2 || isMerging} onClick={mergeFiles}>{isMerging && <LoaderCircle className="spinner" size={18} />}{isMerging ? "Merging PDFs..." : "Merge PDFs"}</button>}
            {(files.length > 0 || downloadUrl || error) && <button className="secondary-action" type="button" onClick={startOver}>Start over</button>}
          </div>
        </section>
      </main>
    </div>
  );
}