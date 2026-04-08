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

function IconUpload() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-slate-400">
      <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16.5A3.5 3.5 0 0016.5 20H7.5A4.5 4.5 0 013 15.5v-.25A4.25 4.25 0 017.25 11H8a4 4 0 018 0h.75A4.25 4.25 0 0121 15.25v.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
        setError(`File must be under ${maxSizeMb} MB`);
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
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          "flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          dragOver
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
        )}
      >
        <IconUpload />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-slate-400">
          Drag & drop or click to browse · Max {maxSizeMb} MB
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
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
