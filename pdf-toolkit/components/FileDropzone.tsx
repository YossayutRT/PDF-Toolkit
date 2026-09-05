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
  const extension = file.name.toLowerCase().split(".").pop();
  const isPdf = accept.includes("pdf") && (file.type === "application/pdf" || extension === "pdf");
  return isPdf && file.size <= maxSize;
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
      setRejectionMessage("Only PDF files up to 50 MB each can be added.");
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
        <small>PDF only · max 50 MB per file</small>
      </div>
      {rejectionMessage && <p className="inline-error" role="alert">{rejectionMessage}</p>}
    </div>
  );
}