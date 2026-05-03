import React, { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest, apiUpload } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getWeek, getMonths, getActivities } from "../lib/babyAge";
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
export default function CradleHq({ user, onLogout, verifiedBanner, onDismissBanner }) {
  const { theme } = useTheme();
  const [data, setData] = useState({
    profile: { name: "", birthdate: "", parentName: "", email: "", phone: "", sex: "" },
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

  const [needsOnboarding, setNeedsOnboarding] = useState(null); // null=loading, true=no profile, false=has profile

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
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

  const week = getWeek(data.profile.birthdate);
  const months = getMonths(data.profile.birthdate);
  const activities = getActivities(week);

  return (
    <div className={`min-h-screen p-4 ${
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
            {user?.display_name && (
              <span className="text-sm text-slate-600">Hi, <strong>{user.display_name}</strong></span>
            )}
            <Button variant="outline" size="sm" onClick={onLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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
                  Tell us a little about your baby to get started.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-name">Baby's Name</Label>
                  <Input
                    id="ob-name"
                    placeholder="e.g. Emma"
                    value={data.profile.name}
                    onChange={e => setData(d => ({ ...d, profile: { ...d.profile, name: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-birthdate">Birth Date</Label>
                  <Input
                    id="ob-birthdate"
                    type="date"
                    value={data.profile.birthdate}
                    onChange={e => setData(d => ({ ...d, profile: { ...d.profile, birthdate: e.target.value } }))}
                  />
                </div>
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
                  </select>
                </div>
              </div>
              <Button
                className="w-full mt-6"
                onClick={handleOnboardingSubmit}
                disabled={!data.profile.name.trim() || !data.profile.birthdate || profileSaving}
              >
                {profileSaving ? "Saving…" : "Get Started →"}
              </Button>
            </div>
          </div>
        )}

        {needsOnboarding === false && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex-wrap justify-start gap-1.5 bg-card/80 p-2">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[60px] text-xs sm:text-sm font-medium">Dashboard</TabsTrigger>
            <TabsTrigger value="memories"  className="flex-1 min-w-[60px] text-xs sm:text-sm font-medium">Memories</TabsTrigger>
            <TabsTrigger value="track"     className="flex-1 min-w-[60px] text-xs sm:text-sm font-medium">Track</TabsTrigger>
            <TabsTrigger value="health"    className="flex-1 min-w-[60px] text-xs sm:text-sm font-medium">Health</TabsTrigger>
            <TabsTrigger value="discover"  className="flex-1 min-w-[60px] text-xs sm:text-sm font-medium">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab
              data={data}
              setData={setData}
              week={week}
              months={months}
              onSaveProfile={saveProfile}
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
      </footer>
    </div>
  );
}
