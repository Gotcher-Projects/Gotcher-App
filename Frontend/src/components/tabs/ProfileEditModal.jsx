import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import PhotoPickerButton from "@/components/ui/PhotoPickerButton";
import { uploadCroppedPhoto } from "@/lib/imageUtils.jsx";
import Avatar from "@/components/ui/Avatar";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "birth", label: "Birth details" },
  { id: "contact", label: "Parent & contact" },
];

const BIRTH_TYPES = [
  { value: "natural", label: "Natural" },
  { value: "c-section", label: "C-section" },
  { value: "induced", label: "Induced" },
  { value: "other", label: "Other" },
];

const EMPTY_BIRTH = {
  birthTime: "", hospital: "", weightLbs: "", heightIn: "", headIn: "",
  birthType: "", birthStory: "", birthPhotoUrl: "",
};

// Normalize a birthDetails object (numbers may come back as numbers) into string-friendly form fields.
function toBirthDraft(bd) {
  if (!bd) return { ...EMPTY_BIRTH };
  return {
    birthTime: bd.birthTime || "",
    hospital: bd.hospital || "",
    weightLbs: bd.weightLbs != null ? String(bd.weightLbs) : "",
    heightIn: bd.heightIn != null ? String(bd.heightIn) : "",
    headIn: bd.headIn != null ? String(bd.headIn) : "",
    birthType: bd.birthType || "",
    birthStory: bd.birthStory || "",
    birthPhotoUrl: bd.birthPhotoUrl || "",
  };
}

// Edit Profile modal — Option A (tabbed): Basics · Birth details · Parent & contact.
// Profile fields bind directly to data.profile (snapshotted on open so Cancel discards). Birth
// details live in their own local draft saved through onSaveBirthDetails (PUT /birth-details).
// Photo uploads (avatar + birth photo) persist immediately and are kept across a Cancel.
export default function ProfileEditModal({
  open, onClose, data, setData, onSaveProfile, onUploadPhoto, profileSaving, accountEmail, onError,
  birthDetails, onSaveBirthDetails, onUploadBirthPhoto, initialTab = "basics",
}) {
  const [tab, setTab] = useState(initialTab);
  const [snapshot, setSnapshot] = useState(null);
  const [birthDraft, setBirthDraft] = useState(EMPTY_BIRTH);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBirthPhoto, setUploadingBirthPhoto] = useState(false);
  const [savingBirth, setSavingBirth] = useState(false);

  const p = data.profile;
  const setField = (key, value) =>
    setData(d => ({ ...d, profile: { ...d.profile, [key]: value } }));
  const setBirth = (key, value) => setBirthDraft(b => ({ ...b, [key]: value }));

  // First render while open: snapshot profile (for discard) and seed the birth draft.
  if (open && snapshot === null) {
    setSnapshot({ ...p });
    setBirthDraft(toBirthDraft(birthDetails));
    setTab(initialTab);
  }

  function discardAndClose() {
    if (snapshot) {
      setData(d => ({ ...d, profile: { ...d.profile, ...snapshot, photoUrl: d.profile.photoUrl } }));
    }
    setSnapshot(null);
    onClose();
  }

  async function handleSave() {
    const ok = await onSaveProfile();
    if (!ok) return;
    // Persist birth details alongside the profile. Numbers parsed; blanks become null server-side.
    setSavingBirth(true);
    try {
      await onSaveBirthDetails?.({
        birthTime: birthDraft.birthTime || null,
        hospital: birthDraft.hospital || null,
        weightLbs: birthDraft.weightLbs !== "" ? parseFloat(birthDraft.weightLbs) : null,
        heightIn: birthDraft.heightIn !== "" ? parseFloat(birthDraft.heightIn) : null,
        headIn: birthDraft.headIn !== "" ? parseFloat(birthDraft.headIn) : null,
        birthType: birthDraft.birthType || null,
        birthStory: birthDraft.birthStory || null,
        birthPhotoUrl: birthDraft.birthPhotoUrl || null,
      });
    } catch {
      onError?.("Failed to save birth details");
      setSavingBirth(false);
      return;
    }
    setSavingBirth(false);
    setSnapshot(null);
    onClose();
  }

  async function handleAvatarPicked({ blob }) {
    setUploadingPhoto(true);
    try {
      await uploadCroppedPhoto(onUploadPhoto, blob);
    } catch {
      onError?.("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleBirthPhotoPicked({ blob }) {
    setUploadingBirthPhoto(true);
    try {
      const url = await uploadCroppedPhoto(onUploadBirthPhoto, blob);
      setBirth("birthPhotoUrl", url);
    } catch {
      onError?.("Failed to upload birth photo");
    } finally {
      setUploadingBirthPhoto(false);
    }
  }

  const saving = profileSaving || savingBirth;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) discardAndClose(); }}>
      <DialogContent
        className="p-0 gap-0 sm:max-w-md overflow-hidden"
        onInteractOutside={e => {
          const t = e.detail?.originalEvent?.target;
          if (t?.closest?.("[data-crop-overlay]")) e.preventDefault();
        }}
      >
        <div className="px-5 py-4 border-b border-border">
          <DialogTitle className="font-display">Edit profile</DialogTitle>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-sm font-medium px-3 py-1.5 rounded-t-lg transition-colors ${
                tab === t.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-3">
          {tab === "basics" && (
            <>
              <div className="flex items-center gap-4">
                <Avatar photoUrl={p.photoUrl} name={p.name} sex={p.sex} size={64} />
                <PhotoPickerButton
                  onPicked={handleAvatarPicked}
                  shape="circle"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {uploadingPhoto ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                  ) : (
                    <span>{p.photoUrl ? "Change photo" : "Add photo"}</span>
                  )}
                </PhotoPickerButton>
              </div>
              <div>
                <Label>Baby's name</Label>
                <Input value={p.name} onChange={e => setField("name", e.target.value)} placeholder="e.g., Harper" />
              </div>
              <div>
                <Label>Birthdate</Label>
                <Input type="date" value={p.birthdate} onChange={e => setField("birthdate", e.target.value)} />
              </div>
              <div>
                <Label>Sex</Label>
                <select
                  value={p.sex || ""}
                  onChange={e => setField("sex", e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Not specified</option>
                  <option value="male">Boy</option>
                  <option value="female">Girl</option>
                </select>
              </div>
            </>
          )}

          {tab === "birth" && (
            <>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center"
                >
                  {birthDraft.birthPhotoUrl
                    ? <img src={birthDraft.birthPhotoUrl} alt="Birth" className="w-full h-full object-cover" />
                    : <span className="text-xs text-muted-foreground text-center px-1">Birth photo</span>}
                </div>
                <PhotoPickerButton
                  onPicked={handleBirthPhotoPicked}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {uploadingBirthPhoto ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                  ) : (
                    <span>{birthDraft.birthPhotoUrl ? "Change birth photo" : "Add birth photo"}</span>
                  )}
                </PhotoPickerButton>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Time of birth</Label>
                  <Input type="time" value={birthDraft.birthTime} onChange={e => setBirth("birthTime", e.target.value)} />
                </div>
                <div>
                  <Label>Hospital / place</Label>
                  <Input value={birthDraft.hospital} onChange={e => setBirth("hospital", e.target.value)} placeholder="St Mary's" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Weight (lbs)</Label>
                  <Input type="number" step="0.01" min="0" value={birthDraft.weightLbs} onChange={e => setBirth("weightLbs", e.target.value)} placeholder="7.5" />
                </div>
                <div>
                  <Label>Length (in)</Label>
                  <Input type="number" step="0.1" min="0" value={birthDraft.heightIn} onChange={e => setBirth("heightIn", e.target.value)} placeholder="20" />
                </div>
                <div>
                  <Label>Head (in)</Label>
                  <Input type="number" step="0.1" min="0" value={birthDraft.headIn} onChange={e => setBirth("headIn", e.target.value)} placeholder="13.8" />
                </div>
              </div>
              <div>
                <Label>Birth type</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {BIRTH_TYPES.map(bt => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => setBirth("birthType", birthDraft.birthType === bt.value ? "" : bt.value)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        birthDraft.birthType === bt.value
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>The story of the day you arrived</Label>
                <Textarea
                  value={birthDraft.birthStory}
                  onChange={e => setBirth("birthStory", e.target.value)}
                  placeholder="The morning you arrived it was raining, and your dad…"
                  rows={4}
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Measurements use lbs / inches (same as growth tracking). All fields optional.</p>
            </>
          )}

          {tab === "contact" && (
            <>
              <div>
                <Label>Your name</Label>
                <Input value={p.parentName} onChange={e => setField("parentName", e.target.value)} placeholder="e.g., Sarah" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input type="tel" value={p.phone} onChange={e => setField("phone", e.target.value)} placeholder="555-0123" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={accountEmail || ""} readOnly disabled className="opacity-70" />
                <p className="text-xs text-muted-foreground mt-1">Your account email — manage it in account settings.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-border bg-muted/30">
          <Button variant="ghost" onClick={discardAndClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-[2]">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
