"use client";

import { useRef, useState } from "react";

const ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*";

export default function FileDropzone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-slate-50 hover:border-brand-400"
        }`}
      >
        <div className="text-3xl">📎</div>
        {file ? (
          <p className="mt-2 font-semibold text-ink-900">{file.name}</p>
        ) : (
          <>
            <p className="mt-2 font-semibold text-ink-700">
              Drag &amp; drop your résumé, or click to browse
            </p>
            <p className="mt-1 text-sm text-ink-500">
              PDF, DOCX, PNG/JPG screenshot, or TXT
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {file && (
        <button
          type="button"
          onClick={() => onFile(null)}
          className="mt-2 text-sm font-medium text-ink-500 hover:text-red-600"
        >
          Remove file
        </button>
      )}
    </div>
  );
}
