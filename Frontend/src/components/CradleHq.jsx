import React, { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest, apiUpload } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, UserRound } from "lucide-react";
import { getWeek, getMonths, getActivities } from "../lib/babyAge";
import { profilePhase } from "../lib/pregnancy";
import CreditsPill from "./CreditsPill";
import PregnancyShell from "./pregnancy/PregnancyShell";
import DashboardTab from "./tabs/DashboardTab";
import MemoriesTab from "./tabs/MemoriesTab";
import TrackTab from "./tabs/TrackTab";
import HealthTab from "./tabs/HealthTab";
import DiscoverTab from "./tabs/DiscoverTab";

// ── Local storage helpers ──────────────────────────────────────────────────────
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function loadLocal(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch { return null; }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CradleHq({ user, onLogout, verifiedBanner, onDismissBanner, onUserUpdate }) {
  const { theme } = useTheme();
  const [data, setData] = useState({
    profile: { name: "", birthdate: "", parentName: "", email: "", phone: "", sex: "", dueDate: "", phase: "", photoUrl: "" },
    milestones: {},
    journal: []
  });
  const [growth, setGrowth] = useState([]);
  const [feeding, setFeeding] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [diaper, setDiaper] = useState([]);
  const [vaccines, setVaccines] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [firsts, setFirsts] = useState([]);
  const [bumpPhotos, setBumpPhotos] = useState([]);
  const [birthDetails, setBirthDetails] = useState(null);

  const [needsOnboarding, setNeedsOnboarding] = useState(null); // null=loading, true=no profile, false=has profile
  const [obStep, setObStep] = useState('choice'); // 'choice' (expecting vs. have baby) → 'details'

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [resending, setResending] = useState(false);
  const [appError, setAppError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthView, setHealthView] = useState('growth');

  function onError(msg) {
    setAppError(msg);
    setTimeout(() => setAppError(null), 6000);
  }

  async function resendVerification() {
    setResending(true);
    try {
      await apiRequest('/auth/resend-verification', { method: 'POST' });
      alert("Verification email sent! Check your inbox.");
    } catch {
      onError("Failed to send verification email.");
    }
    setResending(false);
  }

  useEffect(() => {
    const saved = loadLocal("babyStepsData");
    if (saved) {
      setData(d => ({ ...d, ...saved, profile: { ...d.profile, ...(saved.profile || {}) } }));
    } else if (user) {
      setData(d => ({
        ...d,
        profile: { ...d.profile, parentName: user.display_name || "", email: user.email || "" }
      }));
    }
  }, []);

  useEffect(() => {
    saveLocal("babyStepsData", data);
  }, [data]);

  useEffect(() => {
    apiRequest('/baby-profile')
      .then(profile => {
        setData(d => ({
          ...d,
          profile: {
            ...d.profile,
            name: profile.babyName || d.profile.name,
            birthdate: profile.birthdate || d.profile.birthdate,
            parentName: profile.parentName || d.profile.parentName,
            phone: profile.phone || d.profile.phone,
            sex: profile.sex || d.profile.sex,
            dueDate: profile.dueDate || d.profile.dueDate,
            phase: profile.phase || d.profile.phase,
            photoUrl: profile.photoUrl || d.profile.photoUrl,
          }
        }));
        setNeedsOnboarding(false);
      })
      .catch(err => {
        if (err.status === 404) {
          setNeedsOnboarding(true);
        } else {
          setNeedsOnboarding(false); // network/auth error — fail open
        }
      });
  }, []);

  useEffect(() => {
    apiRequest('/birth-details')
      .then(setBirthDetails)
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/milestones')
      .then(res => {
        const checked = {};
        res.keys.forEach(k => { checked[k] = true; });
        setData(d => ({ ...d, milestones: checked }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/vaccines')
      .then(res => {
        const checked = {};
        res.keys.forEach(k => { checked[k] = true; });
        setVaccines(checked);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/journal')
      .then(entries => setData(d => ({ ...d, journal: entries })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/growth')
      .then(records => setGrowth(records))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/feeding?days=7')
      .then(logs => setFeeding(logs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/sleep?days=30')
      .then(logs => setSleep(logs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/diaper?days=14')
      .then(logs => setDiaper(logs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/appointments')
      .then(list => setAppointments(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest('/first-times')
      .then(list => setFirsts(list))
      .catch(() => {});
  }, []);

  // Bump photos load in both phases (the diary is reachable in pregnancy mode and the baby-mode
  // Memories "Bump" pill). Returns [] for profiles with no pregnancy data — harmless.
  useEffect(() => {
    apiRequest('/bump-photos')
      .then(list => setBumpPhotos(list))
      .catch(() => {});
  }, []);

  async function addJournalEntry(week, title, story, imageUrl, imageOrientation) {
    const entry = await apiRequest('/journal', {
      method: 'POST',
      body: JSON.stringify({ week, title, story, imageUrl, imageOrientation }),
    });
    setData(d => ({ ...d, journal: [entry, ...d.journal] }));
  }

  async function updateJournalEntry(id, title, story, imageOrientation) {
    const entry = await apiRequest(`/journal/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, story, imageOrientation }),
    });
    setData(d => ({ ...d, journal: d.journal.map(e => e.id === id ? entry : e) }));
  }

  async function updateJournalEntryImage(id, file) {
    const form = new FormData();
    form.append('file', file, 'photo.jpg');
    const entry = await apiUpload(`/journal/${id}/image`, form, 'PATCH');
    setData(d => ({ ...d, journal: d.journal.map(e => e.id === id ? entry : e) }));
  }

  async function deleteWithRecovery(optimisticUpdate, deletePath, refetch, errorMsg, restoreMsg) {
    optimisticUpdate();
    try {
      await apiRequest(deletePath, { method: 'DELETE' });
    } catch {
      onError(errorMsg);
      refetch().catch(() => onError(restoreMsg));
    }
  }

  async function deleteJournalEntry(id) {
    await deleteWithRecovery(
      () => setData(d => ({ ...d, journal: d.journal.filter(e => e.id !== id) })),
      `/journal/${id}`,
      () => apiRequest('/journal').then(entries => setData(d => ({ ...d, journal: entries }))),
      "Failed to delete journal entry",
      "Failed to restore journal",
    );
  }

  async function startFeed(type) {
    const log = await apiRequest('/feeding', {
      method: 'POST',
      body: JSON.stringify({ type, startedAt: new Date().toISOString() }),
    });
    setFeeding(f => [log, ...f]);
    return log;
  }

  async function stopFeed(id, endedAt) {
    const log = await apiRequest(`/feeding/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ endedAt }),
    });
    setFeeding(f => f.map(l => l.id === id ? log : l));
    return log;
  }

  async function deleteFeed(id) {
    await deleteWithRecovery(
      () => setFeeding(f => f.filter(l => l.id !== id)),
      `/feeding/${id}`,
      () => apiRequest('/feeding?days=7').then(logs => setFeeding(logs)),
      "Failed to delete feeding entry",
      "Failed to restore feeding log",
    );
  }

  async function manualAddFeed(req) {
    const log = await apiRequest('/feeding', { method: 'POST', body: JSON.stringify(req) });
    if (req.endedAt) {
      const completed = await apiRequest(`/feeding/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          endedAt: req.endedAt,
          amountMl: req.oz ? Math.round(req.oz * 29.5735) : null,
        }),
      });
      setFeeding(f => [completed, ...f]);
    } else {
      setFeeding(f => [log, ...f]);
    }
  }

  async function addSleepLog(req) {
    const log = await apiRequest('/sleep', { method: 'POST', body: JSON.stringify(req) });
    setSleep(s => [log, ...s]);
  }

  async function deleteSleepLog(id) {
    await deleteWithRecovery(
      () => setSleep(s => s.filter(l => l.id !== id)),
      `/sleep/${id}`,
      () => apiRequest('/sleep?days=30').then(logs => setSleep(logs)),
      "Failed to delete sleep entry",
      "Failed to restore sleep log",
    );
  }

  async function addDiaperLog(req) {
    const log = await apiRequest('/diaper', { method: 'POST', body: JSON.stringify(req) });
    setDiaper(p => [log, ...p]);
  }

  async function deleteDiaperLog(id) {
    await deleteWithRecovery(
      () => setDiaper(p => p.filter(l => l.id !== id)),
      `/diaper/${id}`,
      () => apiRequest('/diaper?days=14').then(logs => setDiaper(logs)),
      "Failed to delete diaper entry",
      "Failed to restore diaper log",
    );
  }

  async function addGrowthRecord(req) {
    const record = await apiRequest('/growth', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    setGrowth(g => [record, ...g]);
  }

  async function deleteGrowthRecord(id) {
    await deleteWithRecovery(
      () => setGrowth(g => g.filter(r => r.id !== id)),
      `/growth/${id}`,
      () => apiRequest('/growth').then(records => setGrowth(records)),
      "Failed to delete growth record",
      "Failed to restore growth records",
    );
  }

  async function toggleVaccine(key, checked) {
    setVaccines(v => ({ ...v, [key]: checked }));
    try {
      if (checked) {
        await apiRequest(`/vaccines/${key}`, { method: 'POST' });
      } else {
        await apiRequest(`/vaccines/${key}`, { method: 'DELETE' });
      }
    } catch {
      setVaccines(v => ({ ...v, [key]: !checked }));
    }
  }

  async function addAppointment(req) {
    const appt = await apiRequest('/appointments', { method: 'POST', body: JSON.stringify(req) });
    setAppointments(a => [...a, appt].sort((x, y) => x.appointmentDate.localeCompare(y.appointmentDate)));
  }

  async function updateAppointment(id, patch) {
    const appt = await apiRequest(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setAppointments(a => a.map(x => x.id === id ? appt : x).sort((x, y) => x.appointmentDate.localeCompare(y.appointmentDate)));
  }

  async function deleteAppointment(id) {
    await deleteWithRecovery(
      () => setAppointments(a => a.filter(x => x.id !== id)),
      `/appointments/${id}`,
      () => apiRequest('/appointments').then(list => setAppointments(list)),
      "Failed to delete appointment",
      "Failed to restore appointments",
    );
  }

  async function addFirstTime(req) {
    const ft = await apiRequest('/first-times', { method: 'POST', body: JSON.stringify(req) });
    setFirsts(f => [ft, ...f]);
  }


  async function updateFirstTime(id, patch) {
    const ft = await apiRequest(`/first-times/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setFirsts(f => f.map(x => x.id === id ? ft : x));
  }

  async function deleteFirstTime(id) {
    await deleteWithRecovery(
      () => setFirsts(f => f.filter(x => x.id !== id)),
      `/first-times/${id}`,
      () => apiRequest('/first-times').then(list => setFirsts(list)),
      "Failed to delete first time",
      "Failed to restore first times",
    );
  }


  // ── Bump photos ──
  async function addBumpPhoto(req) {
    const photo = await apiRequest('/bump-photos', { method: 'POST', body: JSON.stringify(req) });
    setBumpPhotos(p => [...p, photo]);
  }

  async function updateBumpPhoto(id, patch) {
    const photo = await apiRequest(`/bump-photos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setBumpPhotos(p => p.map(x => x.id === id ? photo : x));
  }

  async function deleteBumpPhoto(id) {
    await deleteWithRecovery(
      () => setBumpPhotos(p => p.filter(x => x.id !== id)),
      `/bump-photos/${id}`,
      () => apiRequest('/bump-photos').then(list => setBumpPhotos(list)),
      "Failed to delete bump photo",
      "Failed to restore bump photos",
    );
  }

  async function toggleMilestone(key, checked) {
    setData(d => ({ ...d, milestones: { ...d.milestones, [key]: checked } }));
    try {
      if (checked) {
        await apiRequest(`/milestones/${key}`, { method: 'POST' });
      } else {
        await apiRequest(`/milestones/${key}`, { method: 'DELETE' });
      }
    } catch {
      setData(d => ({ ...d, milestones: { ...d.milestones, [key]: !checked } }));
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    let success = false;
    try {
      const savedProfile = await apiRequest('/baby-profile', {
        method: 'PUT',
        body: JSON.stringify({
          babyName: data.profile.name,
          birthdate: data.profile.birthdate || null,
          parentName: data.profile.parentName,
          phone: data.profile.phone,
          sex: data.profile.sex || null,
          dueDate: data.profile.dueDate || null,
          phase: data.profile.phase || 'baby',
        }),
      });
      setData(d => ({
        ...d,
        profile: {
          ...d.profile,
          name: savedProfile.babyName || d.profile.name,
          birthdate: savedProfile.birthdate || d.profile.birthdate,
          parentName: savedProfile.parentName || d.profile.parentName,
          phone: savedProfile.phone || d.profile.phone,
          sex: savedProfile.sex || d.profile.sex,
          dueDate: savedProfile.dueDate || d.profile.dueDate,
          phase: savedProfile.phase || d.profile.phase,
          photoUrl: savedProfile.photoUrl || d.profile.photoUrl,
        }
      }));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
      success = true;
    } catch {
      onError("Failed to save profile");
    }
    setProfileSaving(false);
    return success;
  }

  async function handleOnboardingSubmit() {
    const ok = await saveProfile();
    if (ok) setNeedsOnboarding(false);
  }

  // Square avatar upload — separate endpoint from the book cover photo. Returns the new URL so the
  // modal can show it immediately; also pushes it into profile state.
  async function uploadProfilePhoto(formData) {
    const res = await apiUpload('/baby-profile/photo', formData);
    setData(d => ({ ...d, profile: { ...d.profile, photoUrl: res.url } }));
    return res;
  }

  // Birth details (sv2-s2) — saved from the Edit-Profile modal's "Birth details" tab.
  async function saveBirthDetails(payload) {
    const saved = await apiRequest('/birth-details', { method: 'PUT', body: JSON.stringify(payload) });
    setBirthDetails(saved);
    return saved;
  }

  // The only two client-side paths that change phase after onboarding. Both hit dedicated
  // endpoints — never the profile upsert. There is no generic always-available swap toggle.
  async function markBorn(birthdate, sex) {
    // Throws on failure so the mark-as-born dialog can keep itself open and surface the error.
    const body = { birthdate };
    if (sex !== undefined) body.sex = sex;
    await apiRequest('/baby-profile/mark-born', { method: 'POST', body: JSON.stringify(body) });
    setData(d => ({
      ...d,
      profile: { ...d.profile, birthdate, phase: 'baby', ...(sex !== undefined ? { sex } : {}) },
    }));
  }

  async function undoBirth() {
    try {
      await apiRequest('/baby-profile/phase', { method: 'POST', body: JSON.stringify({ phase: 'pregnancy' }) });
      setData(d => ({ ...d, profile: { ...d.profile, phase: 'pregnancy' } }));
    } catch {
      onError("Failed to undo birth announcement");
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleteInProgress(true);
    setDeleteError("");
    try {
      await apiRequest('/auth/account', { method: 'DELETE' });
      onLogout();
    } catch {
      setDeleteError("Something went wrong. Please try again or contact support.");
      setDeleteInProgress(false);
    }
  }

  const phase = profilePhase(data.profile);
  const week = getWeek(data.profile.birthdate);
  const months = getMonths(data.profile.birthdate);
  const activities = getActivities(week);

  return (
    <div className={`min-h-screen p-4 overflow-x-hidden ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-brand-lavender/10 via-brand-lavender/20 to-color-success/8'
        : 'bg-gradient-to-br from-color-warm/10 via-brand-lavender/20 to-color-success/8'
    }`}>

      {appError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 text-red-800 text-sm px-4 py-2.5 flex items-center justify-between shadow-sm">
          <span>{appError}</span>
          <button onClick={() => setAppError(null)} className="ml-4 text-red-400 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {verifiedBanner === 'success' && (
        <div className="max-w-6xl mx-auto mb-3 p-3 rounded-lg bg-color-success/10 border border-color-success/30 text-color-success text-sm flex justify-between items-center">
          <span>Your email has been verified. Thanks!</span>
          <button onClick={onDismissBanner} className="ml-3 text-color-success hover:text-color-success/70">✕</button>
        </div>
      )}
      {!user?.email_verified && (
        <div className="max-w-6xl mx-auto mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex justify-between items-center">
          <span>Please verify your email address — check your inbox for a link.</span>
          <button
            onClick={resendVerification}
            disabled={resending}
            className="ml-4 text-amber-700 underline disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend"}
          </button>
        </div>
      )}

      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/cradleLogo.png" alt="CradleHQ" className="h-10" />
            <div>
              <h1 className="font-display font-bold text-2xl text-brand-navy">Cradle<span className="text-primary">HQ</span></h1>
              <p className="hidden sm:block text-sm text-muted-foreground">Milestone tracker • Journal • Growth • Feeding • Sleep • Diaper</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Desktop: pill inline in the header actions. On mobile it moves to its own row below. */}
            <div className="hidden sm:flex items-center">
              <CreditsPill />
            </div>
            {user?.display_name && (
              <span className="hidden sm:inline text-sm text-slate-600">Hi, <strong>{user.display_name}</strong></span>
            )}
            <Button variant="outline" size="sm" onClick={() => setProfileModalOpen(true)} className="flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Profile</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Sign Out
            </Button>
          </div>
        </div>
        {/* Mobile only: credits pill on its own right-aligned row so it never crowds the wordmark. */}
        <div className="flex justify-end mt-2 sm:hidden">
          <CreditsPill />
        </div>
      </header>

      <Dialog open={profileModalOpen} onOpenChange={open => { setProfileModalOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Baby's Name</Label>
              <Input
                value={data.profile.name}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, name: e.target.value } }))}
                placeholder="e.g., Harper"
              />
            </div>
            <div>
              <Label>Birthdate</Label>
              <Input
                type="date"
                value={data.profile.birthdate}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, birthdate: e.target.value } }))}
              />
            </div>
            <div>
              <Label>Sex</Label>
              <select
                value={data.profile.sex || ''}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, sex: e.target.value } }))}
                className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not specified</option>
                <option value="male">Boy</option>
                <option value="female">Girl</option>
              </select>
            </div>
            <div>
              <Label>Your Name</Label>
              <Input
                value={data.profile.parentName}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, parentName: e.target.value } }))}
                placeholder="e.g., Sarah"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={data.profile.email}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, email: e.target.value } }))}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={data.profile.phone}
                onChange={e => setData(d => ({ ...d, profile: { ...d.profile, phone: e.target.value } }))}
                placeholder="555-0123"
              />
            </div>
            <Button
              onClick={async () => { await saveProfile(); setProfileModalOpen(false); }}
              disabled={profileSaving}
              className="w-full"
            >
              {profileSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : profileSaved ? 'Saved!' : 'Save Profile'}
            </Button>
            <div className="border-t border-border pt-4 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setDeleteInput(""); setDeleteError(""); setDeleteConfirmOpen(true); setProfileModalOpen(false); }}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={open => { if (!deleteInProgress) setDeleteConfirmOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will permanently delete your account and all associated data — baby profile, feeding logs, sleep logs, diaper logs, growth records, journal entries, photos, and more. <strong>This cannot be undone.</strong>
            </p>
            <div>
              <Label className="text-sm">Type <strong>DELETE</strong> to confirm</Label>
              <Input
                className="mt-1"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                disabled={deleteInProgress}
              />
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteInProgress}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== "DELETE" || deleteInProgress}
              >
                {deleteInProgress ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</> : 'Delete My Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <main className="max-w-6xl mx-auto">
        {needsOnboarding === null && (
          <div className="flex justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading…</p>
          </div>
        )}

        {needsOnboarding === true && (
          <div className="flex justify-center py-10">
            <div className="bg-card border rounded-2xl shadow-sm p-8 w-full max-w-md">
              <div className="flex flex-col items-center mb-6">
                <img src="/images/cradleLogo.png" alt="CradleHQ" className="h-14 mb-3" />
                <h2 className="font-display font-bold text-2xl text-brand-navy">Welcome to CradleHQ!</h2>
                <p className="text-muted-foreground text-sm mt-1 text-center">
                  {obStep === 'choice'
                    ? "Where are you in the journey?"
                    : "Tell us a little to get started."}
                </p>
              </div>

              {obStep === 'choice' && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setData(d => ({ ...d, profile: { ...d.profile, phase: 'pregnancy' } })); setObStep('details'); }}
                    className="w-full text-left rounded-xl border-2 border-input hover:border-primary hover:bg-primary/5 p-4 transition-colors"
                  >
                    <div className="font-semibold text-brand-navy">I'm expecting 🤰</div>
                    <div className="text-sm text-muted-foreground">Track your pregnancy week by week.</div>
                  </button>
                  <button
                    onClick={() => { setData(d => ({ ...d, profile: { ...d.profile, phase: 'baby' } })); setObStep('details'); }}
                    className="w-full text-left rounded-xl border-2 border-input hover:border-primary hover:bg-primary/5 p-4 transition-colors"
                  >
                    <div className="font-semibold text-brand-navy">I already have my baby 👶</div>
                    <div className="text-sm text-muted-foreground">Track milestones, growth, and memories.</div>
                  </button>
                </div>
              )}

              {obStep === 'details' && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-name">
                        {data.profile.phase === 'pregnancy'
                          ? "Baby's name "
                          : "Baby's Name"}
                        {data.profile.phase === 'pregnancy' && (
                          <span className="text-muted-foreground font-normal">(or a nickname — optional)</span>
                        )}
                      </Label>
                      <Input
                        id="ob-name"
                        placeholder={data.profile.phase === 'pregnancy' ? "e.g. Peanut" : "e.g. Emma"}
                        value={data.profile.name}
                        onChange={e => setData(d => ({ ...d, profile: { ...d.profile, name: e.target.value } }))}
                      />
                    </div>
                    {data.profile.phase === 'pregnancy' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="ob-duedate">Due Date</Label>
                        <Input
                          id="ob-duedate"
                          type="date"
                          value={data.profile.dueDate}
                          onChange={e => setData(d => ({ ...d, profile: { ...d.profile, dueDate: e.target.value } }))}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor="ob-birthdate">Birth Date</Label>
                        <Input
                          id="ob-birthdate"
                          type="date"
                          value={data.profile.birthdate}
                          onChange={e => setData(d => ({ ...d, profile: { ...d.profile, birthdate: e.target.value } }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-sex">
                        Sex <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <select
                        id="ob-sex"
                        value={data.profile.sex}
                        onChange={e => setData(d => ({ ...d, profile: { ...d.profile, sex: e.target.value } }))}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="boy">Boy</option>
                        <option value="girl">Girl</option>
                        {data.profile.phase === 'pregnancy' && (
                          <option value="unknown">Not sure yet</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-6"
                    onClick={handleOnboardingSubmit}
                    disabled={
                      !data.profile.name.trim() ||
                      (data.profile.phase === 'pregnancy' ? !data.profile.dueDate : !data.profile.birthdate) ||
                      profileSaving
                    }
                  >
                    {profileSaving ? "Saving…" : "Get Started →"}
                  </Button>
                  <button
                    onClick={() => setObStep('choice')}
                    className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {needsOnboarding === false && phase === 'pregnancy' && (
          <PregnancyShell
            profile={data.profile}
            appointments={appointments}
            onAddAppointment={addAppointment}
            onUpdateAppointment={updateAppointment}
            onDeleteAppointment={deleteAppointment}
            bumpPhotos={bumpPhotos}
            onAddBump={addBumpPhoto}
            onUpdateBump={updateBumpPhoto}
            onDeleteBump={deleteBumpPhoto}
            onBumpUpload={img => apiUpload('/upload?context=bump_photos', img)}
            onMarkBorn={markBorn}
            onError={onError}
          />
        )}

        {needsOnboarding === false && phase !== 'pregnancy' && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex-nowrap overflow-x-auto justify-start gap-1.5 bg-card/80 p-2">
            <TabsTrigger value="dashboard" className="shrink-0 text-xs sm:text-sm font-medium">Dashboard</TabsTrigger>
            <TabsTrigger value="memories"  className="shrink-0 text-xs sm:text-sm font-medium">Memories</TabsTrigger>
            <TabsTrigger value="track"     className="shrink-0 text-xs sm:text-sm font-medium">Track</TabsTrigger>
            <TabsTrigger value="health"    className="shrink-0 text-xs sm:text-sm font-medium">Health</TabsTrigger>
            <TabsTrigger value="discover"  className="shrink-0 text-xs sm:text-sm font-medium">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab
              data={data}
              setData={setData}
              week={week}
              months={months}
              onSaveProfile={saveProfile}
              onUploadPhoto={uploadProfilePhoto}
              birthDetails={birthDetails}
              onSaveBirthDetails={saveBirthDetails}
              onUploadBirthPhoto={img => apiUpload('/upload?context=birth_details', img)}
              profileSaving={profileSaving}
              profileSaved={profileSaved}
              onToggleMilestone={toggleMilestone}
              appointments={appointments}
              feeding={feeding}
              sleep={sleep}
              onManualAdd={manualAddFeed}
              onAddSleep={addSleepLog}
              onAddDiaper={addDiaperLog}
              setActiveTab={setActiveTab}
              setHealthView={setHealthView}
              onError={onError}
            />
          </TabsContent>

          <TabsContent value="memories" className="mt-4">
            <MemoriesTab
              data={data}
              week={week}
              onAdd={addJournalEntry}
              onEdit={updateJournalEntry}
              onDelete={deleteJournalEntry}
              onUpdateImage={updateJournalEntryImage}
              firsts={firsts}
              babyName={data.profile?.name || 'Baby'}
              onAddFirst={addFirstTime}
              onUpdateFirst={updateFirstTime}
              onDeleteFirst={deleteFirstTime}
              onUpload={img => apiUpload('/upload?context=first_times', img)}
              onError={onError}
              dueDate={data.profile?.dueDate}
              bumpPhotos={bumpPhotos}
              onAddBump={addBumpPhoto}
              onUpdateBump={updateBumpPhoto}
              onDeleteBump={deleteBumpPhoto}
              onBumpUpload={img => apiUpload('/upload?context=bump_photos', img)}
            />
          </TabsContent>

          <TabsContent value="track" className="mt-4">
            <TrackTab
              feeding={feeding}
              sleep={sleep}
              diaper={diaper}
              onStart={startFeed}
              onStop={stopFeed}
              onDeleteFeed={deleteFeed}
              onManualAdd={manualAddFeed}
              onAddSleep={addSleepLog}
              onDeleteSleep={deleteSleepLog}
              onAddDiaper={addDiaperLog}
              onDeleteDiaper={deleteDiaperLog}
              onError={onError}
            />
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <HealthTab
              growth={growth}
              vaccines={vaccines}
              appointments={appointments}
              data={data}
              week={week}
              sex={data.profile.sex}
              onAddGrowth={addGrowthRecord}
              onDeleteGrowth={deleteGrowthRecord}
              onToggleVaccine={toggleVaccine}
              onAddAppointment={addAppointment}
              onUpdateAppointment={updateAppointment}
              onDeleteAppointment={deleteAppointment}
              onToggleMilestone={toggleMilestone}
              onError={onError}
              healthView={healthView}
              onHealthViewChange={setHealthView}
            />
          </TabsContent>

          <TabsContent value="discover" className="mt-4">
            <DiscoverTab
              activities={activities}
              week={week}
              months={months}
              birthdate={data.profile.birthdate}
              babyName={data.profile.name}
            />
          </TabsContent>
        </Tabs>
        )}
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-center text-sm text-slate-600">
        <p>Not medical advice • Every baby develops uniquely</p>
        <p className="mt-1">
          <a href="/privacy.html" className="hover:underline">Privacy Policy</a>
          {" · "}
          <a href="/terms.html" className="hover:underline">Terms of Service</a>
        </p>
        {needsOnboarding === false && phase === 'baby' && (
          <p className="mt-3">
            <button
              onClick={() => {
                if (window.confirm("Undo birth announcement? This puts CradleHQ back into pregnancy mode.")) {
                  undoBirth();
                }
              }}
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
            >
              Undo birth announcement
            </button>
          </p>
        )}
      </footer>
    </div>
  );
}
