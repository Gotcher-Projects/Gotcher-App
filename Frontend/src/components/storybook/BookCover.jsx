import React, { useState, useRef } from "react";
import { Camera, Pencil, Check, X } from "lucide-react";
import { openCropModal, uploadCroppedPhoto } from "@/lib/imageUtils";
import { pickPhoto } from "@/lib/camera";
import { apiUpload, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/formatting";

export default function BookCover({ bookId, babyName, birthdate, coverPhotoUrl, coverSubtitle, theme, onCoverPhotoChange, onCoverSubtitleChange, onError }) {
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const cancelCropRef = useRef(null);

  const defaultSubtitle = birthdate
    ? `A memory book · Born ${formatDate(birthdate)}`
    : 'A memory book';
  const displaySubtitle = coverSubtitle ?? defaultSubtitle;

  function startEditSubtitle() {
    setSubtitleDraft(coverSubtitle ?? defaultSubtitle);
    setEditingSubtitle(true);
  }

  async function saveSubtitle() {
    const val = subtitleDraft.trim();
    setEditingSubtitle(false);
    try {
      await apiRequest(`/books/${bookId}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverSubtitle: val }),
      });
      onCoverSubtitleChange?.(val);
    } catch {
      onError?.('Failed to save subtitle');
    }
  }

  async function handlePhotoClick() {
    cancelCropRef.current?.();
    const nativeFile = await pickPhoto();
    if (nativeFile) {
      await cropAndUpload(nativeFile);
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await cropAndUpload(file);
  }

  async function cropAndUpload(file) {
    setUploadingPhoto(true);
    // Lock the crop to 4:3 — the cover photo slot is 4:3 both on-screen (the hero below) and in print
    // (PrintCoverPage's front-cover photo area), so any other ratio would just get re-cropped. (pr4 follow-up)
    openCropModal(
      file,
      async ({ blob }) => {
        try {
          const url = await uploadCroppedPhoto(f => apiUpload(`/books/${bookId}/cover-photo`, f), blob);
          onCoverPhotoChange?.(url);
        } catch {
          onError?.('Failed to upload cover photo');
        } finally {
          setUploadingPhoto(false);
        }
      },
      () => { setUploadingPhoto(false); },
      { aspect: 4 / 3 }
    );
  }

  const bg = theme?.bg || '#fdf9f2';
  const accent = theme?.accent || '#c9a96e';
  const textColor = theme?.textColor || undefined;
  const fontClass = theme?.fontClass || 'font-serif';

  return (
    <div
      className="rounded-xl overflow-hidden border border-[#ddd0b8] dark:border-border max-w-[400px] mx-auto shadow-sm"
      style={{ backgroundColor: bg }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Hero photo or placeholder */}
      <div className="relative w-full" style={{ aspectRatio: '4 / 3', minHeight: 160 }}>
        {coverPhotoUrl ? (
          <img src={coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: accent + '22' }}
          >
            <Camera className="w-10 h-10 opacity-25" style={{ color: accent }} />
          </div>
        )}
        <button
          onClick={handlePhotoClick}
          disabled={uploadingPhoto}
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm transition-opacity bg-white/80 hover:bg-white text-foreground"
        >
          <Camera className="w-3 h-3" />
          {uploadingPhoto ? 'Uploading…' : coverPhotoUrl ? 'Change' : 'Add photo'}
        </button>
      </div>

      {/* Name + subtitle */}
      <div className="px-6 py-5 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.3 }} />
          <span className="text-xs" style={{ color: accent, opacity: 0.5 }}>{theme?.dividerChar || '◆'}</span>
          <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.3 }} />
        </div>

        <h2 className={`font-display font-semibold text-2xl leading-tight ${fontClass}`} style={{ color: textColor }}>
          {babyName || 'Baby'}'s Memory Book
        </h2>

        {editingSubtitle ? (
          <div className="flex items-center gap-1 justify-center mt-1">
            <input
              autoFocus
              value={subtitleDraft}
              onChange={e => setSubtitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveSubtitle(); if (e.key === 'Escape') setEditingSubtitle(false); }}
              className="text-sm text-center border-b border-input bg-transparent focus:outline-none focus:border-ring px-1 py-0.5 w-56"
              style={{ color: textColor, opacity: 0.7 }}
            />
            <button onClick={saveSubtitle} className="p-0.5 text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditingSubtitle(false)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={startEditSubtitle} className="flex items-center gap-1 mx-auto group" title="Edit subtitle">
            <span className={`text-sm ${fontClass} opacity-60 group-hover:opacity-80 transition-opacity`} style={{ color: textColor }}>
              {displaySubtitle}
            </span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" style={{ color: textColor }} />
          </button>
        )}
      </div>
    </div>
  );
}
