"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";

type FileDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  label?: string;
  description?: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
};

const defaultMaxSize = 50 * 1024 * 1024;

function isAcceptedFile(file: File, accept: string, maxSize: number) {
  if (file.size > maxSize) return false;

  const extension = file.name.toLowerCase().split(".").pop();

  // Check if file type matches accept string
  if (accept.includes("pdf") && (file.type === "application/pdf" || extension === "pdf")) {
    return true;
  }
  if (accept.includes("image/jpeg") && (file.type === "image/jpeg" || extension === "jpg" || extension === "jpeg")) {
    return true;
  }
  if (accept.includes("image/png") && (file.type === "image/png" || extension === "png")) {
    return true;
  }
  if (accept.includes("image/webp") && (file.type === "image/webp" || extension === "webp")) {
    return true;
  }

  return false;
}

export default function FileDropzone({
  onFilesSelected,
  label = "Drop files here",
  description = "or click to browse from your device",
  accept = ".pdf,application/pdf",
  maxSize = defaultMaxSize,
  multiple = true,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const acceptedFiles = files.filter((file) => isAcceptedFile(file, accept, maxSize));

    if (acceptedFiles.length !== files.length) {
      const maxMb = maxSize / (1024 * 1024);
      const fileTypeMsg = accept.includes("pdf") ? "PDF files" : "image files";
      setRejectionMessage(`Only ${fileTypeMsg} up to ${Math.round(maxMb)} MB each can be added.`);
    } else {
      setRejectionMessage("");
    }

    if (acceptedFiles.length > 0) {
      onFilesSelected(multiple ? acceptedFiles : acceptedFiles.slice(0, 1));
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFiles(event.target.files);
      event.target.value = "";
    }
  };

  return (
    <div>
      <div
        className={`dropzone ${isDragging ? "dropzone--active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} hidden />
        <span className="dropzone-icon"><FileUp size={24} /></span>
        <strong>{label}</strong>
        <span>{description}</span>
        <small>{accept.includes("pdf") ? "PDF" : "Image"} only · max {Math.round(maxSize / (1024 * 1024))} MB per file</small>
      </div>
      {rejectionMessage && <p className="inline-error" role="alert">{rejectionMessage}</p>}
    </div>
  );
}