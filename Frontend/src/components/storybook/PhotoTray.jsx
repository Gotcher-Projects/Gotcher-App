import React, { useState } from "react";
import { X, Upload } from "lucide-react";
import { apiUpload } from "@/lib/api";

// Bottom-sheet photo picker — choose from already-added photos or upload a new
// one to the chapter. Used by the ScrapbookBuilder.
export default function PhotoTray({ photos, chapterId, onSelect, onUploadDone, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Upload the raw file straight away — no orientation crop here. The caller's assignPhotoToSlot
  // runs the single slot-shaped crop (openSlotCropModal) once the photo lands, so the user isn't
  // asked to pick landscape/portrait only to have it re-cropped to the slot (sv2-s7.5b fix 2).
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file, file.name || 'photo.jpg');
      const data = await apiUpload(`/storybook/${chapterId}/chapter-photos`, form);
      onUploadDone({ sourceKey: data.key, url: data.url, label: data.label || '' });
    } catch {
      setUploadError('Upload failed. Please try again.');
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-background rounded-t-2xl p-4 space-y-3 max-h-[60vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Choose a photo</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-color-highlight/40 hover:border-color-highlight/70 hover:bg-color-warm/10 cursor-pointer transition-colors text-sm text-muted-foreground ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4 text-color-highlight/60 shrink-0" />
          {uploading ? 'Uploading…' : 'Upload a photo'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No photos added yet. Upload one above or go back to Step 2 to add photos to your entries.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-safe">
            {photos.map(photo => (
              <button
                key={photo.sourceKey}
                onClick={() => onSelect(photo)}
                className="group relative rounded-lg overflow-hidden aspect-square"
              >
                <img src={photo.url} alt={photo.label || ''} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                {photo.label && (
                  <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center px-1 py-0.5 leading-tight line-clamp-1">
                    {photo.label}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
