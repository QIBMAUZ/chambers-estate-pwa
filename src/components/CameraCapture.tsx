'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, Check, X, RefreshCw, Eye } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  initialImage?: string | null;
  label?: string;
  helperText?: string;
}

export function CameraCapture({
  onCapture,
  initialImage,
  label = 'Snap or Upload Payment Proof / Receipt',
  helperText = 'Use your mobile camera to snap the bank transfer receipt or select from gallery',
}: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const [loading, setLoading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const processFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      onCapture(result);
      setLoading(false);
    };
    reader.onerror = () => {
      setLoading(false);
      alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setPreview(null);
    onCapture('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="w-full space-y-2">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      {/* Hidden Inputs */}
      {/* 1. Native Environment Camera Capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* 2. Gallery / Desktop File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview ? (
        <div className="relative border-2 border-emerald-500 rounded-xl overflow-hidden bg-slate-900 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Proof preview"
            className="w-full h-48 sm:h-56 object-cover object-center group-hover:opacity-90 transition"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Image Captured
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFullPreview(true)}
                className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs backdrop-blur-sm transition"
                title="View Full Size"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs backdrop-blur-sm transition flex items-center gap-1"
                title="Re-snap"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs backdrop-blur-sm transition"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-4 sm:p-6 text-center bg-slate-50 dark:bg-slate-900/50 transition">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Native Mobile Camera Button */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition"
            >
              <Camera className="w-4 h-4" />
              <span>Snap with Camera</span>
            </button>

            {/* Gallery Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm rounded-lg transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload from Device</span>
            </button>
          </div>
          <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
            {loading ? 'Processing image...' : helperText}
          </p>
        </div>
      )}

      {/* Modal for full preview */}
      {showFullPreview && preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullPreview(false)}
        >
          <div className="relative max-w-2xl max-h-[90vh] overflow-auto rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Full preview" className="w-full h-auto object-contain rounded" />
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute top-3 right-3 bg-black/80 hover:bg-black text-white p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
