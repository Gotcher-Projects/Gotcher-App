import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Pencil, Plus } from "lucide-react";
import PhotoPickerButton from "@/components/ui/PhotoPickerButton";
import { uploadCroppedPhoto } from "@/lib/imageUtils.jsx";
import { apiRequest, apiUpload } from "@/lib/api";

const ROLE_PRESETS = ["Mum", "Dad", "Nana", "Pop", "Grandad", "Grandma", "Grandpa", "Brother", "Sister", "Step-Dad", "Step-Mum", "Carer"];

// Auto-infer the structured bucket the future family tree uses. The user never sets this directly.
function inferCategory(role) {
  const r = (role || "").toLowerCase();
  if (/(mum|mom|mother|dad|father|parent|step-?(dad|mum|mom))/.test(r)) return "parent";
  if (/(brother|sister|sibling)/.test(r)) return "sibling";
  if (/(nana|pop|gran|nan|grand)/.test(r)) return "grandparent";
  return "other";
}

// The relationship tier drives family-tree placement. The user sets it explicitly (inferCategory only
// seeds a sensible default from the title).
const RELATIONSHIPS = [
  { v: "parent", l: "Parent" },
  { v: "grandparent", l: "Grandparent" },
  { v: "sibling", l: "Sibling" },
  { v: "other", l: "Other" },
];

const EMPTY_FORM = { name: "", role: "", bio: "", photoUrl: "", roleCategory: "", linkedMemberId: null };

// "Your People" roster manager + per-page selection. Self-contained: does its own CRUD against
// /family-members. On Done, reports the selected member ids + variant + the fresh roster so the
// builder can write the page config and live-render the People page.
//
// mode: "select" (People page) shows the per-page selection UI (checkboxes + layout variant);
//       "roster" (Family Tree page) hides it — the tree shows everyone by role, so there's nothing
//       to select. Both modes share the same add/edit/delete roster CRUD.
export default function FamilyRosterPopup({ open, onClose, initialSelectedIds = [], initialVariant = "two-up", onApply, onError, mode = "select" }) {
  const selectMode = mode !== "roster";
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set(initialSelectedIds));
  const [variant, setVariant] = useState(initialVariant === "spotlight" ? "spotlight" : "two-up");

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialSelectedIds));
    setVariant(initialVariant === "spotlight" ? "spotlight" : "two-up");
    setLoading(true);
    apiRequest("/family-members")
      .then(list => setMembers(list || []))
      .catch(() => onError?.("Failed to load people"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function startAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(m) {
    setForm({
      name: m.name || "", role: m.role || "", bio: m.bio || "", photoUrl: m.photoUrl || "",
      roleCategory: m.roleCategory || "", linkedMemberId: m.linkedMemberId ?? null,
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  async function handlePhotoPicked({ blob }) {
    setUploading(true);
    try {
      const url = await uploadCroppedPhoto(fd => apiUpload("/upload?context=family", fd), blob);
      setForm(f => ({ ...f, photoUrl: url }));
    } catch {
      onError?.("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function saveForm() {
    if (!form.name.trim() || !form.role.trim()) {
      onError?.("Name and role are required");
      return;
    }
    setSaving(true);
    const category = form.roleCategory || inferCategory(form.role);
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      roleCategory: category,
      linkedMemberId: category === "grandparent" ? (form.linkedMemberId ?? null) : null,
      photoUrl: form.photoUrl || null,
      bio: form.bio || null,
    };
    try {
      if (editingId) {
        const updated = await apiRequest(`/family-members/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMembers(ms => ms.map(m => (m.id === editingId ? updated : m)));
      } else {
        const created = await apiRequest("/family-members", { method: "POST", body: JSON.stringify(payload) });
        setMembers(ms => [...ms, created]);
        setSelected(s => new Set(s).add(created.id)); // auto-select new people for this page
      }
      resetForm();
    } catch {
      onError?.("Failed to save person");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(id) {
    try {
      await apiRequest(`/family-members/${id}`, { method: "DELETE" });
      setMembers(ms => ms.filter(m => m.id !== id));
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    } catch {
      onError?.("Failed to delete person");
    }
  }

  function toggleSelected(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function done() {
    // Preserve roster order in the selected id list.
    const selectedIds = members.filter(m => selected.has(m.id)).map(m => m.id);
    onApply?.({ selectedMemberIds: selectedIds, variant, members });
    onClose();
  }

  const maxForVariant = variant === "spotlight" ? 1 : 2;
  const selectedCount = members.filter(m => selected.has(m.id)).length;
  // Parents a grandparent can be linked to (exclude the person being edited).
  const parentOptions = members.filter(m => m.roleCategory === "parent" && m.id !== editingId);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 sm:max-w-lg overflow-hidden"
        onInteractOutside={e => {
          const t = e.detail?.originalEvent?.target;
          if (t?.closest?.("[data-crop-overlay]")) e.preventDefault();
        }}
      >
        <div className="px-5 py-4 border-b border-border">
          <DialogTitle className="font-display">Your People</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {selectMode
              ? "Manage your family roster and pick who appears on this page."
              : "Manage your family roster — everyone here appears on the tree by their role."}
          </p>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Variant toggle — only when picking who appears on a People page */}
          {selectMode && (
          <div>
            <Label className="text-xs">Layout</Label>
            <div className="flex gap-2 mt-1">
              {[{ v: "two-up", l: "Two people" }, { v: "spotlight", l: "Spotlight (one)" }].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setVariant(o.v)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    variant === o.v ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedCount > maxForVariant
                ? `This layout shows ${maxForVariant}; the first ${maxForVariant} selected will appear.`
                : `Select up to ${maxForVariant} to feature on this page.`}
            </p>
          </div>
          )}

          {/* Roster */}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {members.length === 0 && !showForm && (
                <p className="text-sm text-muted-foreground text-center py-4">No people yet — add your first below.</p>
              )}
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  {selectMode && <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelected(m.id)} />}
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-brand-lavender flex items-center justify-center">
                    {m.photoUrl
                      ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-semibold text-primary">{(m.name || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.role}</div>
                  </div>
                  <button onClick={() => startEdit(m)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteMember(m.id)} className="p-1.5 text-muted-foreground hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit form */}
          {showForm ? (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-brand-lavender flex items-center justify-center">
                  {form.photoUrl
                    ? <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="text-base font-semibold text-primary">{(form.name || "?").charAt(0).toUpperCase()}</span>}
                </div>
                <PhotoPickerButton onPicked={handlePhotoPicked} shape="circle" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <span>{form.photoUrl ? "Change photo" : "Add photo"}</span>}
                </PhotoPickerButton>
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Grandma Jo" />
              </div>
              <div>
                <Label className="text-xs">Title <span className="text-muted-foreground">(what they're called)</span></Label>
                <Input value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value, roleCategory: f.roleCategory || inferCategory(e.target.value) }))}
                  placeholder="e.g., Nana" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ROLE_PRESETS.map(r => (
                    <button key={r} type="button"
                      onClick={() => setForm(f => ({ ...f, role: r, roleCategory: f.roleCategory || inferCategory(r) }))}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Relationship</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {RELATIONSHIPS.map(o => (
                    <button key={o.v} type="button"
                      onClick={() => setForm(f => ({ ...f, roleCategory: o.v, linkedMemberId: o.v === "grandparent" ? f.linkedMemberId : null }))}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        form.roleCategory === o.v ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Sets where they sit on the family tree.</p>
              </div>
              {form.roleCategory === "grandparent" && (
                <div>
                  <Label className="text-xs">Whose parent are they?</Label>
                  {parentOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">Add the parents first, then come back to link grandparents to the right side.</p>
                  ) : (
                    <select
                      value={form.linkedMemberId ?? ""}
                      onChange={e => setForm(f => ({ ...f, linkedMemberId: e.target.value ? Number(e.target.value) : null }))}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— not set —</option>
                      {parentOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role})` : ""}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Puts them on the correct side of the tree, over that parent.</p>
                </div>
              )}
              <div>
                <Label className="text-xs">A few words about them <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} placeholder="What makes them special…" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveForm} disabled={saving} size="sm">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : (editingId ? "Save changes" : "Add person")}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={startAdd} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add a person
            </Button>
          )}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-border bg-muted/30">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={done} className="flex-[2]">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
