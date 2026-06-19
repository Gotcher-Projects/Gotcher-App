import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Camera, Trash2, Pencil, Baby } from "lucide-react";
import { openCropModal } from "@/lib/imageUtils.jsx";
import { pickPhoto } from "@/lib/camera";
import { firstEmptyWeek, groupByWeek, deriveWeek } from "@/lib/bumpDiary";
import BumpCard from "./BumpCard";

const today = () => new Date().toISOString().slice(0, 10);

// Reusable photo picker button (web file-input fallback when the native camera picker is unavailable).
function PhotoPicker({ cancelCropRef, onCropped, children }) {
  const inputRef = useRef(null);
  const open = async () => {
    const file = await pickPhoto();
    if (file) {
      cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => {
        cancelCropRef.current = null;
        onCropped({ blob, orientation });
      });
    } else {
      inputRef.current?.click();
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-color-highlight transition-colors"
      >
        <Camera className="w-4 h-4" />
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files[0];
          if (!file) return;
          e.target.value = "";
          cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => {
            cancelCropRef.current = null;
            onCropped({ blob, orientation });
          });
        }}
      />
    </>
  );
}

// ── Add form ─────────────────────────────────────────────────────────────────
function AddBumpForm({ defaultWeek, weekRefDate, onAdd, onUpload, onError }) {
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const [week, setWeek] = useState(defaultWeek);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [cropped, setCropped] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Keep the week field in step with the suggested default until the user starts an entry.
  const pristine = !cropped && !note;
  useEffect(() => { if (pristine) setWeek(defaultWeek); }, [defaultWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Date → Week: deriving the week from the entry's date keeps backfilled photos labelled
  // correctly. Overridable — the user can still hand-edit the Week field afterward.
  function handleDateChange(newDate) {
    setDate(newDate);
    const derived = deriveWeek(weekRefDate, newDate);
    if (derived != null) setWeek(derived);
  }

  const hasNote = note.trim().length > 0;
  const canSave = !!week && (!!cropped || hasNote);

  async function handleSave() {
    if (!week) { onError("Week is required"); return; }
    if (!cropped && !hasNote) { onError("Add a photo or a note to save an entry"); return; }
    setSaving(true);
    try {
      let imageUrl = null;
      let imageOrientation = null;
      if (cropped) {
        setUploading(true);
        const form = new FormData();
        form.append("file", cropped.blob, "photo.jpg");
        const res = await onUpload(form);
        setUploading(false);
        imageUrl = res.url;
        imageOrientation = cropped.orientation || "portrait";
      }
      await onAdd({
        week: Number(week),
        imageUrl,
        note: note.trim() || null,
        takenDate: date || null,
        imageOrientation,
      });
      setCropped(null);
      setNote("");
    } catch {
      onError("Failed to save entry");
      setUploading(false);
    }
    setSaving(false);
  }

  return (
    <Card className="bg-color-warm/25 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Camera className="w-5 h-5 text-color-highlight" /> New entry
        </h3>
        <p className="text-xs text-muted-foreground -mt-2">Add a photo, a note, or both.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Week</Label>
            <Input
              type="number" min={1} max={42} value={week}
              onChange={e => setWeek(e.target.value)}
              className="bg-white focus-visible:ring-color-highlight"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input
              type="date" value={date} max={today()}
              onChange={e => handleDateChange(e.target.value)}
              className="bg-white focus-visible:ring-color-highlight"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Photo (optional)</Label>
          <PhotoPicker cancelCropRef={cancelCropRef} onCropped={setCropped}>
            {cropped ? `Photo ready (${cropped.orientation})` : "Add a photo"}
          </PhotoPicker>
          {cropped && (
            <img src={URL.createObjectURL(cropped.blob)} alt="preview" className="mt-2 w-full max-w-[200px] rounded-lg object-cover" />
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Note</Label>
          <Textarea
            rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="How are you feeling? What happened this week?"
            className="bg-white focus-visible:ring-color-highlight"
          />
        </div>
        <LoadingButton
          onClick={handleSave}
          loading={saving}
          loadingText={uploading ? "Uploading photo…" : "Saving…"}
          disabled={saving || !canSave}
          className="w-full bg-color-highlight hover:bg-color-highlight/90"
        >
          Save entry
        </LoadingButton>
      </CardContent>
    </Card>
  );
}

// ── Single entry: BumpCard display + inline edit ──────────────────────────────
function BumpEntry({ photo, weekRefDate, onUpdate, onDelete, onUpload, onError }) {
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const [editing, setEditing] = useState(false);
  const [week, setWeek] = useState(photo.week);
  const [date, setDate] = useState(photo.takenDate || "");
  const [note, setNote] = useState(photo.note || "");
  const [cropped, setCropped] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function startEdit() {
    setWeek(photo.week);
    setDate(photo.takenDate || "");
    setNote(photo.note || "");
    setCropped(null);
    setConfirmDelete(false);
    setEditing(true);
  }

  // Date → Week (overridable), one-directional — mirrors the add form.
  function handleDateChange(newDate) {
    setDate(newDate);
    const derived = deriveWeek(weekRefDate, newDate);
    if (derived != null) setWeek(derived);
  }

  async function saveEdit() {
    if (!week) { onError("Week is required"); return; }
    // An entry must keep at least a photo (existing or new) or a note.
    if (!cropped && !photo.imageUrl && !note.trim()) {
      onError("Add a photo or a note to save an entry");
      return;
    }
    setSaving(true);
    try {
      const patch = { week: Number(week), note: note.trim() || null, takenDate: date || null };
      if (cropped) {
        setUploading(true);
        const form = new FormData();
        form.append("file", cropped.blob, "photo.jpg");
        const res = await onUpload(form);
        setUploading(false);
        patch.imageUrl = res.url;
        patch.imageOrientation = cropped.orientation;
      }
      await onUpdate(photo.id, patch);
      setEditing(false);
    } catch {
      onError("Failed to update bump photo");
      setUploading(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(photo.id);
    } catch {
      onError("Failed to delete bump photo");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Card className="bg-color-warm/30 rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Week</Label>
              <Input type="number" min={1} max={42} value={week} onChange={e => setWeek(e.target.value)} className="bg-white focus-visible:ring-color-highlight" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} max={today()} onChange={e => handleDateChange(e.target.value)} className="bg-white focus-visible:ring-color-highlight" />
            </div>
          </div>
          <div>
            {photo.imageUrl && !cropped && (
              <img src={photo.imageUrl} alt={`Bump at week ${photo.week}`} className="w-full max-w-[200px] rounded-lg object-cover mb-2" />
            )}
            {cropped && (
              <img src={URL.createObjectURL(cropped.blob)} alt="new preview" className="w-full max-w-[200px] rounded-lg object-cover mb-2" />
            )}
            <PhotoPicker cancelCropRef={cancelCropRef} onCropped={setCropped}>
              {cropped ? `Photo ready (${cropped.orientation})` : photo.imageUrl ? "Replace photo" : "Add a photo"}
            </PhotoPicker>
          </div>
          <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="bg-white focus-visible:ring-color-highlight" />
          <div className="flex gap-2">
            <LoadingButton size="sm" loading={saving} loadingText={uploading ? "Uploading…" : "Saving…"} onClick={saveEdit}>Save</LoadingButton>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const actions = (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
      {confirmDelete ? (
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1 disabled:opacity-50">Yes</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={startEdit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/5">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <BumpCard
      imageUrl={photo.imageUrl}
      imageOrientation={photo.imageOrientation}
      week={photo.week}
      takenDate={photo.takenDate}
      note={photo.note}
      actions={actions}
    />
  );
}

// ── Diary (add form + week-divider timeline) ──────────────────────────────────
export default function BumpDiary({ photos = [], currentWeek, weekRefDate, onAdd, onUpdate, onDelete, onUpload, onError }) {
  // Pregnancy mode passes a valid currentWeek; baby mode passes null → default to first empty week.
  const defaultWeek = currentWeek && currentWeek >= 1 && currentWeek <= 42 ? currentWeek : firstEmptyWeek(photos);
  const groups = groupByWeek(photos);

  return (
    <div className="space-y-6">
      <AddBumpForm defaultWeek={defaultWeek} weekRefDate={weekRefDate} onAdd={onAdd} onUpload={onUpload} onError={onError} />

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Baby className="w-14 h-14 text-primary/25 mb-3" />
          <p className="font-semibold text-muted-foreground">No bump photos yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add your first one above — watch your bump grow week by week.</p>
        </div>
      ) : (
        groups.map(({ week, items }) => (
          <div key={week} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">Week {week}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(p => (
                <BumpEntry key={p.id} photo={p} weekRefDate={weekRefDate} onUpdate={onUpdate} onDelete={onDelete} onUpload={onUpload} onError={onError} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
