"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";

interface FileUploadProps {
  accept: string;
  maxSizeMb?: number;
  onFile: (file: File, base64: string) => void;
  label?: string;
  className?: string;
}

export default function FileUpload({
  accept,
  maxSizeMb = 10,
  onFile,
  label = "Upload file",
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      const allowedTypes = accept.split(",").map((t) => t.trim());
      if (!allowedTypes.some((t) => file.type === t || file.name.endsWith(t))) {
        setError(`Unsupported file type. Accepted: ${accept}`);
        return;
      }

      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`File must be under ${maxSizeMb}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        onFile(file, base64);
      };
      reader.readAsDataURL(file);
    },
    [accept, maxSizeMb, onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-sm transition-colors",
          dragOver
            ? "border-sky-500 bg-sky-500/10 text-sky-300"
            : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
        )}
      >
        <span className="text-2xl">📁</span>
        <span>{label}</span>
        <span className="text-xs text-slate-500">
          Drag & drop or click • Max {maxSizeMb}MB
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
