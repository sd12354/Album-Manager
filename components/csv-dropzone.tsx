"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/csv";

interface CSVDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  className?: string;
}

export function CSVDropzone({
  onFileSelect,
  selectedFile,
  className,
}: CSVDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent/50 bg-card px-8 py-16 transition-colors hover:border-accent hover:bg-muted/10",
        isDragActive && "border-accent bg-accent/5",
        className
      )}
    >
      <input {...getInputProps()} />
      <Upload className="mb-4 h-10 w-10 text-accent" />
      {selectedFile ? (
        <>
          <p className="text-lg font-semibold text-foreground">
            {selectedFile.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatFileSize(selectedFile.size)}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Click or drop to replace
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-foreground">
            Drop your CSV here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse files
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            .csv files only · Album Title, Artist, Genre, Condition, Catalog #
          </p>
        </>
      )}
    </div>
  );
}
