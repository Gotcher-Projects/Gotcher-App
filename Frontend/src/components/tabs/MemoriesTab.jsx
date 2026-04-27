import React, { useState, useRef, useEffect } from "react";
import PillNav from "@/components/ui/PillNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, BookOpen, Loader2, Trash2, Pencil } from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatEntryDate } from "@/lib/formatting";
import { apiUpload } from "@/lib/api";
import { shareFirstTime } from "@/lib/share";
import { openCropModal } from "@/lib/imageUtils.jsx";

export default function MemoriesTab({ data, week, onAdd, onEdit, onDelete, onUpdateImage, firsts, babyName, onAddFirst, onUpdateFirst, onDeleteFirst, onUpload, onError }) {
  const [view, setView] = useState('journal');

  return (
    <>
      <PillNav
        options={[
          { value: 'journal', label: 'Journal' },
          { value: 'firsts',  label: 'Firsts' },
        ]}
        active={view}
        onChange={setView}
        activeClass="bg-color-highlight/10 border-color-highlight/30 text-color-highlight"
      />
      {view === 'journal' && <JournalTab data={data} week={week} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} onUpdateImage={onUpdateImage} onError={onError} />}
      {view === 'firsts'  && <FirstTimesTab firsts={firsts} babyName={babyName} onAdd={onAddFirst} onUpdate={onUpdateFirst} onDelete={onDeleteFirst} onUpload={onUpload} onError={onError} />}
    </>
  );
}

// ── Journal ────────────────────────────────────────────────────────────────────

function JournalTab({ data, week, onAdd, onEdit, onDelete, onUpdateImage, onError }) {
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [croppedPhoto, setCroppedPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editCroppedPhoto, setEditCroppedPhoto] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editUploadingImage, setEditUploadingImage] = useState(false);

  const addEntry = async () => {
    if (!title && !story) {
      onError("Add a title or story before saving.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = null;
      if (croppedPhoto) {
        const form = new FormData();
        form.append('file', croppedPhoto.blob, 'photo.jpg');
        const result = await apiUpload('/upload?context=journal', form);
        imageUrl = result.url;
      }
      await onAdd(week, title || `Week ${week}`, story, imageUrl, croppedPhoto?.orientation || 'landscape');
      setTitle("");
      setStory("");
      setCroppedPhoto(null);
    } catch {
      onError("Failed to save entry. Please try again.");
    }
    setSaving(false);
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditTitle(e.title);
    setEditStory(e.story || "");
    setEditCroppedPhoto(null);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCroppedPhoto(null);
  };

  const saveEdit = async (e) => {
    setEditSaving(true);
    try {
      await onEdit(e.id, editTitle || e.title, editStory, editCroppedPhoto?.orientation);
      if (editCroppedPhoto) {
        setEditUploadingImage(true);
        await onUpdateImage(e.id, editCroppedPhoto.blob);
        setEditUploadingImage(false);
      }
      setEditingId(null);
      setEditCroppedPhoto(null);
    } catch {
      onError("Failed to save changes. Please try again.");
    }
    setEditSaving(false);
  };

  const handleExportPdf = async () => {
    if (!data.journal.length) return;
    setExporting(true);
    try {
      const { generatePdf, downloadPdf } = await import('@/lib/pdf');
      const babyName = data.profile.name || "Baby";
      const doc = await generatePdf(data.journal, babyName);
      downloadPdf(doc, babyName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      onError("Failed to generate PDF. Please try again.");
    }
    setExporting(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl lg:sticky lg:top-6 lg:self-start bg-color-warm/20">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-color-highlight" /> New Entry
          </h2>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="First smile!" className="bg-color-warm/15 focus-visible:ring-color-highlight" />
          </div>

          <div>
            <Label>Story</Label>
            <Textarea rows={5} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Today was special..." className="bg-color-warm/15 focus-visible:ring-color-highlight" />
          </div>

          <div>
            <Label>Photo (optional)</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-color-highlight transition-colors">
              <Camera className="w-4 h-4" />
              {croppedPhoto ? `Photo ready (${croppedPhoto.orientation})` : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  e.target.value = '';
                  cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => { cancelCropRef.current = null; setCroppedPhoto({ blob, orientation }); });
                }}
              />
            </label>
            {croppedPhoto && (
              <img src={URL.createObjectURL(croppedPhoto.blob)} alt="preview" className="mt-2 w-full max-w-xs rounded-lg object-cover" />
            )}
          </div>

          <LoadingButton onClick={addEntry} loading={saving} loadingText="Saving..." className="w-full bg-color-highlight hover:bg-color-highlight/90">
            Save Entry
          </LoadingButton>

          <div className="pt-4 border-t">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-color-highlight" /> Memory Book
            </h3>
            <p className="text-sm text-muted-foreground mb-3">Export all entries as a formatted PDF with photos</p>
            <Button
              onClick={handleExportPdf}
              disabled={!data.journal.length || exporting}
              className="w-full bg-color-highlight hover:bg-color-highlight/90"
            >
              {exporting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                : <><BookOpen className="w-4 h-4 mr-2" /> Export Memory Book</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-lg font-bold">Journal Entries</h3>

        {!data.journal.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="w-16 h-16 text-primary/30 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">No memories yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Add your first entry above.</p>
          </div>
        ) : (
          data.journal.map(e => (
            <Card key={e.id} className="bg-color-warm/20 shadow-md shadow-color-highlight/20 rounded-2xl overflow-hidden transition-shadow hover:shadow-lg hover:shadow-color-highlight/30">
              {editingId === e.id ? (
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={ev => setEditTitle(ev.target.value)} placeholder="Title" className="font-semibold text-base focus-visible:ring-color-highlight" />
                    <Textarea rows={5} value={editStory} onChange={ev => setEditStory(ev.target.value)} placeholder="Story" className="focus-visible:ring-color-highlight" />
                    <div>
                      {e.image_url && !editCroppedPhoto && (
                        <img src={e.image_url} alt={e.title} className="w-full max-w-xs rounded-lg object-cover mb-2" />
                      )}
                      {editCroppedPhoto && (
                        <img src={URL.createObjectURL(editCroppedPhoto.blob)} alt="new photo preview" className="w-full max-w-xs rounded-lg object-cover mb-2" />
                      )}
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Camera className="w-4 h-4" />
                        {editCroppedPhoto ? `Photo ready (${editCroppedPhoto.orientation})` : e.image_url ? "Replace photo" : "Add a photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={ev => {
                            const file = ev.target.files[0];
                            if (!file) return;
                            ev.target.value = '';
                            cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => { cancelCropRef.current = null; setEditCroppedPhoto({ blob, orientation }); });
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <LoadingButton
                        size="sm"
                        loading={editSaving || editUploadingImage}
                        onClick={() => saveEdit(e)}
                      >
                        Save
                      </LoadingButton>
                      <Button size="sm" variant="outline" onClick={cancelEdit} disabled={editSaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              ) : e.image_url && e.image_orientation === 'portrait' ? (
                // Portrait: image left, text right
                <div className="flex min-h-[220px]">
                  <div className="w-2/5 flex-shrink-0 overflow-hidden">
                    <img src={e.image_url} alt={e.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <span className="text-xs font-medium bg-color-highlight/15 text-color-highlight px-2 py-0.5 rounded-full border border-color-highlight/20">
                        Week {e.week}
                      </span>
                      <h4 className="font-display text-lg font-bold text-foreground mt-2 mb-1 leading-snug">{e.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{formatEntryDate(e.entry_date || e.date)}</p>
                      {e.story && (
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-5">{e.story}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-border mt-3">
                      {confirmDeleteId === e.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Delete?</span>
                          <button onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => startEdit(e)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" title="Edit entry">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => setConfirmDeleteId(e.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors" title="Delete entry">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Landscape or no image: standard stacked layout
                <>
                <CardContent className="p-5 pb-3">
                  <span className="text-sm font-medium bg-color-highlight/15 text-color-highlight px-2.5 py-0.5 rounded-full border border-color-highlight/20">
                    Week {e.week}
                  </span>
                  <h4 className="font-display text-2xl font-bold text-foreground mt-2 mb-1 leading-snug">{e.title}</h4>
                  <p className="text-xs text-muted-foreground">{formatEntryDate(e.entry_date || e.date)}</p>
                </CardContent>
                {e.image_url && (
                  <div className="w-full aspect-[4/3] overflow-hidden">
                    <img src={e.image_url} alt={e.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className="p-5 pt-3">
                  {e.story && (
                    <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap mb-4">{e.story}</p>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-border">
                    {confirmDeleteId === e.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Delete?</span>
                        <button onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => startEdit(e)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" title="Edit entry">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => setConfirmDeleteId(e.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors" title="Delete entry">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
                </>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── First Times ────────────────────────────────────────────────────────────────

const FIRST_TIME_PRESETS = [
  'Smile', 'Laugh', 'Solid food', 'Steps', 'Word',
  'Haircut', 'Swim', 'Trip', 'Tooth', 'Rolled over',
];

function FirstTimesTab({ firsts, babyName, onAdd, onUpdate, onDelete, onUpload, onError }) {
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const [mode, setMode] = useState('suggestions'); // 'suggestions' | 'custom'
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [croppedImage, setCroppedImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!label.trim()) { onError('Label is required'); return; }
    if (!date) { onError('Date is required'); return; }
    setSaving(true);
    try {
      let imageUrl = null;
      if (croppedImage) {
        setUploadingPhoto(true);
        const form = new FormData();
        form.append('file', croppedImage.blob, 'photo.jpg');
        const res = await onUpload(form);
        imageUrl = res.url;
        setUploadingPhoto(false);
      }
      await onAdd({ label: label.trim(), occurredDate: date, imageUrl, notes: notes.trim() || null, imageOrientation: croppedImage?.orientation || 'landscape' });
      setLabel('');
      setDate('');
      setNotes('');
      setCroppedImage(null);
      setMode('suggestions');
    } catch (e) {
      onError('Failed to save first time');
    }
    setSaving(false);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="bg-color-warm/35 lg:sticky lg:top-6 lg:self-start">
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-display font-semibold text-foreground">Add a First</h3>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('suggestions')}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${mode === 'suggestions' ? 'bg-color-highlight/10 border-color-highlight/30 text-color-highlight' : 'border-border text-muted-foreground hover:bg-secondary'}`}
            >
              Suggestions
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${mode === 'custom' ? 'bg-color-highlight/10 border-color-highlight/30 text-color-highlight' : 'border-border text-muted-foreground hover:bg-secondary'}`}
            >
              Custom
            </button>
          </div>

          {mode === 'suggestions' ? (
            <div className="flex flex-wrap gap-2">
              {FIRST_TIME_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => { setLabel(p); setMode('custom'); }}
                  className="text-sm px-3 py-1 rounded-full bg-color-highlight/10 text-color-highlight border border-color-highlight/20 hover:bg-color-highlight/20 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <Input
              placeholder="e.g. First word"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={120}
              className="focus-visible:ring-color-highlight"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="bg-color-warm/15 focus-visible:ring-color-highlight" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Photo (optional)</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-color-highlight transition-colors">
                <Camera className="w-4 h-4" />
                {croppedImage ? `Photo ready (${croppedImage.orientation})` : 'Add a photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    e.target.value = '';
                    cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => { cancelCropRef.current = null; setCroppedImage({ blob, orientation }); });
                  }}
                />
              </label>
            </div>
          </div>

          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="bg-color-warm/15 focus-visible:ring-color-highlight"
          />

          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !date}
            className="w-full py-2 rounded-lg bg-color-highlight text-white font-medium hover:bg-color-highlight/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (uploadingPhoto ? 'Uploading photo…' : 'Saving…') : 'Save First'}
          </button>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        {firsts.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No firsts recorded yet. Add one above!</p>
        ) : (
          <div className="space-y-4">
            {firsts.map(ft => (
              <FirstTimeCard
                key={ft.id}
                ft={ft}
                babyName={babyName}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onUpload={onUpload}
                onError={onError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FirstTimeCard({ ft, babyName, onUpdate, onDelete, onUpload, onError }) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(ft.label);
  const [editDate, setEditDate] = useState(ft.occurredDate);
  const [editNotes, setEditNotes] = useState(ft.notes || '');
  const [editCroppedImage, setEditCroppedImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  function handleStartEdit() {
    setEditLabel(ft.label);
    setEditDate(ft.occurredDate);
    setEditNotes(ft.notes || '');
    setEditCroppedImage(null);
    setEditing(true);
  }

  async function handleShare() {
    try {
      const result = await shareFirstTime({ label: ft.label, occurredDate: fmtDate(ft.occurredDate), babyName, imageUrl: ft.imageUrl });
      if (result === 'copied') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User cancelled share — ignore
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      let imageUrl = undefined;
      if (editCroppedImage) {
        setUploadingPhoto(true);
        const form = new FormData();
        form.append('file', editCroppedImage.blob, 'photo.jpg');
        const res = await onUpload(form);
        imageUrl = res.url;
        setUploadingPhoto(false);
      }
      const patch = { label: editLabel.trim(), occurredDate: editDate, notes: editNotes.trim() || null };
      if (imageUrl !== undefined) { patch.imageUrl = imageUrl; patch.imageOrientation = editCroppedImage.orientation; }
      await onUpdate(ft.id, patch);
      setEditing(false);
    } catch {
      onError('Failed to update entry');
      setUploadingPhoto(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(ft.id);
    } catch {
      onError('Failed to delete entry');
      setDeleting(false);
    }
  }

  const textContent = (
    <div>
      <p className="font-display font-semibold text-foreground text-lg leading-tight">{ft.label}</p>
      <p className="text-sm text-muted-foreground">{fmtDate(ft.occurredDate)}</p>
      {ft.notes && <p className="text-sm text-muted-foreground mt-1">{ft.notes}</p>}
    </div>
  );

  const actionBar = (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
      <button onClick={handleShare} title="Share" className="text-muted-foreground hover:text-color-highlight p-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
      {copied && <span className="text-xs text-color-success font-medium">Copied!</span>}
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={handleStartEdit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/5">
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50 px-2 py-1 rounded hover:bg-red-50">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );

  const editContent = (
    <div className="space-y-2">
      <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={120} className="focus-visible:ring-color-highlight" />
      <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="focus-visible:ring-color-highlight" />
      <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Notes" className="focus-visible:ring-color-highlight" />
      <div>
        <Label className="text-xs text-muted-foreground">{ft.imageUrl ? 'Replace photo (optional)' : 'Add photo (optional)'}</Label>
        <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-color-highlight transition-colors">
          <Camera className="w-4 h-4" />
          {editCroppedImage ? `Photo ready (${editCroppedImage.orientation})` : ft.imageUrl ? 'Replace photo' : 'Add a photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files[0];
              if (!file) return;
              e.target.value = '';
              cancelCropRef.current = openCropModal(file, ({ blob, orientation }) => { cancelCropRef.current = null; setEditCroppedImage({ blob, orientation }); });
            }}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSaveEdit}
          disabled={saving || !editLabel.trim() || !editDate}
          className="flex-1 py-1.5 rounded-lg bg-color-highlight text-white text-sm font-medium hover:bg-color-highlight/90 disabled:opacity-50"
        >
          {saving ? (uploadingPhoto ? 'Uploading…' : 'Saving…') : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="flex-1 py-1.5 rounded-lg border border-border text-muted-foreground text-sm hover:bg-secondary">
          Cancel
        </button>
      </div>
    </div>
  );

  if (editing) {
    return (
      <Card className="bg-color-warm/30 shadow-md shadow-color-highlight/20 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-color-highlight/30">
        <CardContent className="pt-3 space-y-2">{editContent}</CardContent>
      </Card>
    );
  }

  if (ft.imageUrl && ft.imageOrientation === 'portrait') {
    return (
      <Card className="bg-color-warm/30 shadow-md shadow-color-highlight/20 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-color-highlight/30">
        <div className="flex min-h-[180px]">
          <div className="w-2/5 flex-shrink-0 overflow-hidden">
            <img src={ft.imageUrl} alt={ft.label} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 p-3 min-w-0">
            {textContent}
          </div>
        </div>
        {actionBar}
      </Card>
    );
  }

  if (ft.imageUrl) {
    return (
      <Card className="bg-color-warm/30 shadow-md shadow-color-highlight/20 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-color-highlight/30">
        <CardContent className="pt-3 pb-2">{textContent}</CardContent>
        <div className="w-full aspect-[4/3] overflow-hidden">
          <img src={ft.imageUrl} alt={ft.label} className="w-full h-full object-cover" />
        </div>
        {actionBar}
      </Card>
    );
  }

  return (
    <Card className="bg-color-warm/30 shadow-md shadow-color-highlight/20 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-color-highlight/30">
      <CardContent className="pt-3 pb-2">{textContent}</CardContent>
      {actionBar}
    </Card>
  );
}
