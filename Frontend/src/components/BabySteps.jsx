import React, { useEffect, useState } from "react";
import { apiRequest, apiUpload } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Baby } from "lucide-react";
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
export default function BabySteps({ user, onLogout, verifiedBanner, onDismissBanner }) {
  const [data, setData] = useState({
    profile: { name: "", birthdate: "", parentName: "", email: "", phone: "", sex: "" },
    milestones: {},
    journal: []
  });
  const [growth, setGrowth] = useState([]);
  const [feeding, setFeeding] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [poop, setPoop] = useState([]);
  const [vaccines, setVaccines] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [firsts, setFirsts] = useState([]);

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
      })
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
    apiRequest('/poop?days=14')
      .then(logs => setPoop(logs))
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
        body: JSON.stringify({ endedAt: req.endedAt }),
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

  async function addPoopLog(req) {
    const log = await apiRequest('/poop', { method: 'POST', body: JSON.stringify(req) });
    setPoop(p => [log, ...p]);
  }

  async function deletePoopLog(id) {
    await deleteWithRecovery(
      () => setPoop(p => p.filter(l => l.id !== id)),
      `/poop/${id}`,
      () => apiRequest('/poop?days=14').then(logs => setPoop(logs)),
      "Failed to delete poop entry",
      "Failed to restore poop log",
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
    } catch {
      onError("Failed to save profile");
    }
    setProfileSaving(false);
  }

  const week = getWeek(data.profile.birthdate);
  const months = getMonths(data.profile.birthdate);
  const activities = getActivities(week);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 p-4">

      {appError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 text-red-800 text-sm px-4 py-2.5 flex items-center justify-between shadow-sm">
          <span>{appError}</span>
          <button onClick={() => setAppError(null)} className="ml-4 text-red-400 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {verifiedBanner === 'success' && (
        <div className="max-w-6xl mx-auto mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between items-center">
          <span>Your email has been verified. Thanks!</span>
          <button onClick={onDismissBanner} className="ml-3 text-emerald-600 hover:text-emerald-800">✕</button>
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
            <Baby className="w-12 h-12 text-fuchsia-600" />
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 via-sky-600 to-emerald-600">
                Baby Steps
              </h1>
              <p className="text-sm text-slate-600">Milestone tracker • Journal • Growth • Feeding • Sleep • Poop</p>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex-wrap justify-start gap-2 bg-white/70 p-2">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[100px]">Dashboard</TabsTrigger>
            <TabsTrigger value="memories"  className="flex-1 min-w-[100px]">Memories</TabsTrigger>
            <TabsTrigger value="track"     className="flex-1 min-w-[100px]">Track</TabsTrigger>
            <TabsTrigger value="health"    className="flex-1 min-w-[100px]">Health</TabsTrigger>
            <TabsTrigger value="discover"  className="flex-1 min-w-[100px]">Discover</TabsTrigger>
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
              onAddPoop={addPoopLog}
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
              poop={poop}
              onStart={startFeed}
              onStop={stopFeed}
              onDeleteFeed={deleteFeed}
              onManualAdd={manualAddFeed}
              onAddSleep={addSleepLog}
              onDeleteSleep={deleteSleepLog}
              onAddPoop={addPoopLog}
              onDeletePoop={deletePoopLog}
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
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-center text-sm text-slate-600">
        <p>Not medical advice • Every baby develops uniquely</p>
      </footer>
    </div>
  );
}
