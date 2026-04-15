import React, { useEffect, useState } from "react";
import { apiRequest, apiUpload } from "../lib/api";
import { shareFirstTime } from "../lib/share";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Baby, Camera, Loader2, BookOpen, ShoppingBag, Users, CheckCircle2, Mail, Phone, Package, Sparkles, Trash2, Pencil, TrendingUp, Utensils, Timer, StopCircle, Moon, Sun, Droplets, HelpCircle, Plus, X, CalendarDays } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MILESTONES, VACCINES } from "../lib/babyData";
import { getWeek, formatBabyAge, getActivities } from "../lib/babyAge";
import { formatEntryDate } from "../lib/formatting";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ── Local storage helpers ──────────────────────────────────────────────────────
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function load(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch { return null; }
}

// ── Vaccines ───────────────────────────────────────────────────────────────────
const VACCINE_AGE_LABELS = {
  birth: "Birth",
  "2m":  "2 Months",
  "4m":  "4 Months",
  "6m":  "6 Months",
  "12m": "12 Months",
  "15m": "15 Months",
  "18m": "18 Months",
};

function VaccineTab({ vaccines, onToggle }) {
  return (
    <div className="space-y-4">
      {Object.entries(VACCINES).map(([ageGroup, items]) => {
        const givenInGroup = items.filter((_, i) => vaccines[`${ageGroup}-${i}`]).length;
        const isComplete = givenInGroup === items.length;

        return (
          <Card key={ageGroup} className="shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{VACCINE_AGE_LABELS[ageGroup]}</h3>
                <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-700'
                    : givenInGroup > 0
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {givenInGroup}/{items.length} given{isComplete ? ' ✓' : ''}
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-sky-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(givenInGroup / items.length) * 100}%` }}
                />
              </div>

              <div className="space-y-2">
                {items.map((vaccine, i) => {
                  const key = `${ageGroup}-${i}`;
                  const checked = !!vaccines[key];
                  return (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      checked ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200'
                    }`}>
                      <Checkbox
                        id={key}
                        checked={checked}
                        onCheckedChange={val => onToggle(key, !!val)}
                      />
                      <Label htmlFor={key} className="cursor-pointer flex-1 text-slate-700">
                        {vaccine}
                      </Label>
                      {checked && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BabySteps({ user, onLogout, verifiedBanner, onDismissBanner }) {
  const [data, setData] = useState({
    profile: { name: "", birthdate: "", parentName: "", email: "", phone: "" },
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

  const [memoriesView, setMemoriesView] = useState('journal');
  const [trackView, setTrackView] = useState('feeding');
  const [healthView, setHealthView] = useState('growth');
  const [discoverView, setDiscoverView] = useState('marketplace');

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
    const saved = load("babyStepsData");
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
    save("babyStepsData", data);
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

  async function addJournalEntry(week, title, story, imageUrl) {
    const entry = await apiRequest('/journal', {
      method: 'POST',
      body: JSON.stringify({ week, title, story, imageUrl }),
    });
    setData(d => ({ ...d, journal: [entry, ...d.journal] }));
  }

  async function updateJournalEntry(id, title, story) {
    const entry = await apiRequest(`/journal/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, story }),
    });
    setData(d => ({ ...d, journal: d.journal.map(e => e.id === id ? entry : e) }));
  }

  async function updateJournalEntryImage(id, file) {
    const form = new FormData();
    form.append('file', file);
    const entry = await apiUpload(`/journal/${id}/image`, form, 'PATCH');
    setData(d => ({ ...d, journal: d.journal.map(e => e.id === id ? entry : e) }));
  }

  async function deleteJournalEntry(id) {
    setData(d => ({ ...d, journal: d.journal.filter(e => e.id !== id) }));
    try {
      await apiRequest(`/journal/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/journal').then(entries => setData(d => ({ ...d, journal: entries }))).catch(() => {});
    }
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
    setFeeding(f => f.filter(l => l.id !== id));
    try {
      await apiRequest(`/feeding/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/feeding?days=7').then(logs => setFeeding(logs)).catch(() => {});
    }
  }

  async function manualAddFeed(req) {
    const log = await apiRequest('/feeding', { method: 'POST', body: JSON.stringify(req) });
    // if endedAt was provided, patch it immediately
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
    setSleep(s => s.filter(l => l.id !== id));
    try {
      await apiRequest(`/sleep/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/sleep?days=30').then(logs => setSleep(logs)).catch(() => {});
    }
  }

  async function addPoopLog(req) {
    const log = await apiRequest('/poop', { method: 'POST', body: JSON.stringify(req) });
    setPoop(p => [log, ...p]);
  }

  async function deletePoopLog(id) {
    setPoop(p => p.filter(l => l.id !== id));
    try {
      await apiRequest(`/poop/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/poop?days=14').then(logs => setPoop(logs)).catch(() => {});
    }
  }

  async function addGrowthRecord(req) {
    const record = await apiRequest('/growth', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    setGrowth(g => [record, ...g]);
  }

  async function deleteGrowthRecord(id) {
    setGrowth(g => g.filter(r => r.id !== id));
    try {
      await apiRequest(`/growth/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/growth').then(records => setGrowth(records)).catch(() => {});
    }
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
    setAppointments(a => a.filter(x => x.id !== id));
    try {
      await apiRequest(`/appointments/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/appointments').then(list => setAppointments(list)).catch(() => {});
    }
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
    setFirsts(f => f.filter(x => x.id !== id));
    try {
      await apiRequest(`/first-times/${id}`, { method: 'DELETE' });
    } catch {
      apiRequest('/first-times').then(list => setFirsts(list)).catch(() => {});
    }
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
  const months = Math.floor(week / 4.345);
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
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full h-auto flex-wrap justify-start gap-2 bg-white/70 p-2">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[100px]">Dashboard</TabsTrigger>
            <TabsTrigger value="memories" className="flex-1 min-w-[100px]">Memories</TabsTrigger>
            <TabsTrigger value="track" className="flex-1 min-w-[100px]">Track</TabsTrigger>
            <TabsTrigger value="health" className="flex-1 min-w-[100px]">Health</TabsTrigger>
            <TabsTrigger value="discover" className="flex-1 min-w-[100px]">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab data={data} setData={setData} week={week} months={months} onSaveProfile={saveProfile} profileSaving={profileSaving} profileSaved={profileSaved} onToggleMilestone={toggleMilestone} appointments={appointments} />
          </TabsContent>

          <TabsContent value="memories" className="mt-4">
            <PillNav
              options={[{ value: 'journal', label: 'Journal' }, { value: 'firsts', label: 'Firsts' }]}
              active={memoriesView}
              onChange={setMemoriesView}
            />
            {memoriesView === 'journal' && <JournalTab data={data} week={week} onAdd={addJournalEntry} onEdit={updateJournalEntry} onDelete={deleteJournalEntry} onUpdateImage={updateJournalEntryImage} onError={onError} />}
            {memoriesView === 'firsts'  && <FirstTimesTab firsts={firsts} babyName={data.profile?.name || 'Baby'} onAdd={addFirstTime} onUpdate={updateFirstTime} onDelete={deleteFirstTime} onUpload={img => apiUpload('/upload?context=first_times', img)} onError={onError} />}
          </TabsContent>

          <TabsContent value="track" className="mt-4">
            <PillNav
              options={[{ value: 'feeding', label: 'Feeding' }, { value: 'sleep', label: 'Sleep' }, { value: 'poop', label: 'Poop' }]}
              active={trackView}
              onChange={setTrackView}
            />
            {trackView === 'feeding' && <FeedingTab logs={feeding} onStart={startFeed} onStop={stopFeed} onDelete={deleteFeed} onManualAdd={manualAddFeed} onError={onError} />}
            {trackView === 'sleep'   && <SleepTab logs={sleep} onAdd={addSleepLog} onDelete={deleteSleepLog} onError={onError} />}
            {trackView === 'poop'    && <PoopTab logs={poop} onAdd={addPoopLog} onDelete={deletePoopLog} onError={onError} />}
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <PillNav
              options={[
                { value: 'growth', label: 'Growth' },
                { value: 'vaccines', label: 'Vaccines' },
                { value: 'appointments', label: 'Appointments' },
                { value: 'milestones', label: 'Milestones' },
              ]}
              active={healthView}
              onChange={setHealthView}
            />
            {healthView === 'growth'       && <GrowthTab records={growth} onAdd={addGrowthRecord} onDelete={deleteGrowthRecord} onError={onError} />}
            {healthView === 'vaccines'     && <VaccineTab vaccines={vaccines} onToggle={toggleVaccine} />}
            {healthView === 'appointments' && <AppointmentTab appointments={appointments} onAdd={addAppointment} onUpdate={updateAppointment} onDelete={deleteAppointment} onError={onError} />}
            {healthView === 'milestones'   && <MilestonesTab data={data} week={week} onToggle={toggleMilestone} />}
          </TabsContent>

          <TabsContent value="discover" className="mt-4">
            <PillNav
              options={[
                { value: 'marketplace', label: 'Marketplace' },
                { value: 'playdates', label: 'Playdates' },
                { value: 'activities', label: 'Activities' },
              ]}
              active={discoverView}
              onChange={setDiscoverView}
            />
            {discoverView === 'marketplace' && <MarketplaceTab />}
            {discoverView === 'playdates'   && <PlaydatesTab />}
            {discoverView === 'activities'  && (
              <ActivitiesTab
                activities={activities}
                week={week}
                months={months}
                birthdate={data.profile.birthdate}
                babyName={data.profile.name}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-center text-sm text-slate-600">
        <p>Not medical advice • Every baby develops uniquely</p>
      </footer>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardTab({ data, setData, week, months, onSaveProfile, profileSaving, profileSaved, onToggleMilestone, appointments }) {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          {(() => {
            const ageText = formatBabyAge(data.profile.birthdate);
            const name = data.profile.name || 'Baby';
            return ageText ? `${name} is ${ageText}` : `${name}'s milestones`;
          })()}
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Profile Setup</h3>
            <div>
              <Label>Baby's Name</Label>
              <Input
                value={data.profile.name}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, name: e.target.value } }))}
                placeholder="e.g., Harper"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Birthdate</Label>
              <Input
                type="date"
                value={data.profile.birthdate}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, birthdate: e.target.value } }))}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Your Name</Label>
              <Input
                value={data.profile.parentName}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, parentName: e.target.value } }))}
                placeholder="e.g., Sarah"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={data.profile.email}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, email: e.target.value } }))}
                placeholder="your@email.com"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={data.profile.phone}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, phone: e.target.value } }))}
                placeholder="555-0123"
                className="bg-white"
              />
            </div>
            <Button
              onClick={onSaveProfile}
              disabled={profileSaving}
              className="w-full bg-fuchsia-600"
            >
              {profileSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : profileSaved ? (
                "Saved!"
              ) : (
                "Save Profile"
              )}
            </Button>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Milestones</h3>

            {!data.profile.birthdate ? (
              <p className="text-slate-600 p-4 bg-white rounded-lg border text-center text-sm">
                Set a birthdate above to see milestones
              </p>
            ) : (() => {
              const gk = Math.floor(week / 4) * 4;
              const allGks = Object.keys(MILESTONES).map(Number).filter(k => k <= gk);
              const total = allGks.reduce((s, k) => s + MILESTONES[k].length, 0);
              const achieved = allGks.reduce((s, k) =>
                s + MILESTONES[k].filter((_, i) => data.milestones[`${k}-${i}`]).length, 0);
              const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;
              const currentItems = MILESTONES[gk] || [];
              return (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <span>Overall progress</span>
                      <span>{achieved} / {total}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-fuchsia-500 to-emerald-500 h-3 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{pct}% complete</p>
                  </div>

                  <h4 className="font-medium text-sm text-slate-700 mb-2">Week {gk}–{gk + 4}</h4>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {currentItems.map((m, i) => {
                      const key = `${gk}-${i}`;
                      const checked = !!data.milestones[key];
                      return (
                        <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                          checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                        }`}>
                          <Checkbox
                            id={`dash-${key}`}
                            checked={checked}
                            onCheckedChange={val => onToggleMilestone(key, !!val)}
                          />
                          <Label htmlFor={`dash-${key}`} className="cursor-pointer text-sm flex-1 text-slate-700">
                            {m}
                          </Label>
                          {checked && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="p-3 bg-white rounded-lg border text-center">
                <div className="text-2xl font-bold text-fuchsia-600">
                  {Object.values(data.milestones).filter(Boolean).length}
                </div>
                <div className="text-xs text-slate-600">Milestones</div>
              </div>
              <div className="p-3 bg-white rounded-lg border text-center">
                <div className="text-2xl font-bold text-sky-600">{data.journal.length}</div>
                <div className="text-xs text-slate-600">Memories</div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-xl border">
              <h4 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Upcoming Appointments
              </h4>
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const upcoming = (appointments || [])
                  .filter(a => a.appointmentDate >= today && !a.isCompleted)
                  .slice(0, 3);
                if (upcoming.length === 0) {
                  return <p className="text-xs text-slate-500">No upcoming appointments</p>;
                }
                return (
                  <div className="space-y-1.5">
                    {upcoming.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="font-medium text-emerald-700 min-w-[52px]">
                          {new Date(a.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="truncate">{a.appointmentType || '—'}</span>
                        {a.doctorName && <span className="text-slate-500 truncate">· {a.doctorName}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Milestones ─────────────────────────────────────────────────────────────────
function MilestonesTab({ data, week, onToggle }) {
  if (!week) {
    return (
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <p className="text-slate-600">Set a birthdate in Dashboard to track milestones</p>
        </CardContent>
      </Card>
    );
  }

  const groupKey = Math.floor(week / 4) * 4;
  const allGroupKeys = Object.keys(MILESTONES)
    .map(Number)
    .filter(k => k <= groupKey)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {allGroupKeys.map(gk => {
        const items = MILESTONES[gk];
        const achievedInGroup = items.filter((_, i) => data.milestones[`${gk}-${i}`]).length;
        const isComplete = achievedInGroup === items.length;

        return (
          <Card key={gk} className="shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">Week {gk}–{gk + 4}</h3>
                <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-700'
                    : achievedInGroup > 0
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {achievedInGroup}/{items.length}{isComplete ? ' ✓' : ''}
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(achievedInGroup / items.length) * 100}%` }}
                />
              </div>

              <div className="space-y-2">
                {items.map((m, i) => {
                  const key = `${gk}-${i}`;
                  const checked = !!data.milestones[key];
                  return (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                    }`}>
                      <Checkbox
                        id={key}
                        checked={checked}
                        onCheckedChange={val => onToggle(key, !!val)}
                      />
                      <Label htmlFor={key} className="cursor-pointer flex-1 text-slate-700">
                        {m}
                      </Label>
                      {checked && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Journal ────────────────────────────────────────────────────────────────────
function JournalTab({ data, week, onAdd, onEdit, onDelete, onUpdateImage, onError }) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState(null);
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
      if (photoFile) {
        const form = new FormData();
        form.append('file', photoFile);
        const result = await (await import('../lib/api')).apiUpload('/upload?context=journal', form);
        imageUrl = result.url;
      }
      await onAdd(week, title || `Week ${week}`, story, imageUrl);
      setTitle("");
      setStory("");
      setPhotoFile(null);
    } catch {
      onError("Failed to save entry. Please try again.");
    }
    setSaving(false);
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditTitle(e.title);
    setEditStory(e.story || "");
    setEditPhotoFile(null);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPhotoFile(null);
  };

  const saveEdit = async (e) => {
    setEditSaving(true);
    try {
      await onEdit(e.id, editTitle || e.title, editStory);
      if (editPhotoFile) {
        setEditUploadingImage(true);
        await onUpdateImage(e.id, editPhotoFile);
        setEditUploadingImage(false);
      }
      setEditingId(null);
      setEditPhotoFile(null);
    } catch {
      onError("Failed to save changes. Please try again.");
    }
    setEditSaving(false);
  };

  const handleExportPdf = async () => {
    if (!data.journal.length) return;
    setExporting(true);
    try {
      const { generatePdf, downloadPdf } = await import('../lib/pdf');
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
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" /> New Entry
          </h2>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="First smile!" className="bg-white" />
          </div>

          <div>
            <Label>Story</Label>
            <Textarea rows={5} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Today was special..." className="bg-white" />
          </div>

          <div>
            <Label>Photo (optional)</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-sky-600 transition-colors">
              <Camera className="w-4 h-4" />
              {photoFile ? photoFile.name : "Add a photo"}
              <input type="file" accept="image/*" className="hidden" onChange={e => setPhotoFile(e.target.files[0] || null)} />
            </label>
            {photoFile && (
              <img src={URL.createObjectURL(photoFile)} alt="preview" className="mt-2 w-full max-w-xs rounded-lg object-cover" />
            )}
          </div>

          <LoadingButton onClick={addEntry} loading={saving} loadingText="Saving..." className="w-full bg-sky-600">
            Save Entry
          </LoadingButton>

          <div className="pt-4 border-t">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Memory Book
            </h3>
            <p className="text-sm text-slate-600 mb-3">Export all entries as a formatted PDF with photos</p>
            <Button
              onClick={handleExportPdf}
              disabled={!data.journal.length || exporting}
              className="w-full bg-fuchsia-600"
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
            <Camera className="w-16 h-16 text-fuchsia-200 mb-4" />
            <p className="text-lg font-semibold text-slate-500">No memories yet</p>
            <p className="text-sm text-slate-400 mt-1">Add your first entry above.</p>
          </div>
        ) : (
          data.journal.map(e => (
            <Card key={e.id} className="shadow-md rounded-2xl border-l-4 border-l-fuchsia-300 overflow-hidden transition-shadow hover:shadow-lg">
              <CardContent className="p-5">
                {editingId === e.id ? (
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={ev => setEditTitle(ev.target.value)} placeholder="Title" className="bg-white font-semibold text-base" />
                    <Textarea rows={5} value={editStory} onChange={ev => setEditStory(ev.target.value)} placeholder="Story" className="bg-white" />
                    <div>
                      {e.image_url && !editPhotoFile && (
                        <img src={e.image_url} alt={e.title} className="w-full max-w-xs rounded-lg object-cover mb-2" />
                      )}
                      {editPhotoFile && (
                        <img src={URL.createObjectURL(editPhotoFile)} alt="new photo preview" className="w-full max-w-xs rounded-lg object-cover mb-2" />
                      )}
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-sky-600 transition-colors">
                        <Camera className="w-4 h-4" />
                        {editPhotoFile ? editPhotoFile.name : e.image_url ? "Replace photo" : "Add a photo"}
                        <input type="file" accept="image/*" className="hidden" onChange={ev => setEditPhotoFile(ev.target.files[0] || null)} />
                      </label>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <LoadingButton
                        size="sm"
                        loading={editSaving || editUploadingImage}
                        onClick={() => saveEdit(e)}
                        className="bg-sky-600"
                      >
                        Save
                      </LoadingButton>
                      <Button size="sm" variant="outline" onClick={cancelEdit} disabled={editSaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {e.image_url && (
                      <img src={e.image_url} alt={e.title} className="w-full rounded-xl object-contain mb-4 shadow-sm bg-slate-50" />
                    )}
                    <span className="text-sm font-medium bg-fuchsia-50 text-fuchsia-700 px-2.5 py-0.5 rounded-full border border-fuchsia-100">
                      Week {e.week}
                    </span>
                    <h4 className="text-2xl font-bold text-slate-800 mt-2 mb-1 leading-snug">{e.title}</h4>
                    <p className="text-xs text-slate-400 mb-3">{formatEntryDate(e.entry_date || e.date)}</p>
                    {e.story && (
                      <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{e.story}</p>
                    )}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                      {confirmDeleteId === e.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">Delete?</span>
                          <button onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-1">No</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => startEdit(e)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500 transition-colors" title="Edit entry">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => setConfirmDeleteId(e.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors" title="Delete entry">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── Growth Tracker ─────────────────────────────────────────────────────────────
// Convert total inches to display string: e.g. 26.5 → 2' 2.5"
function inchesToDisplay(totalIn) {
  if (totalIn == null) return '—';
  const n = parseFloat(totalIn);
  const ft = Math.floor(n / 12);
  const inches = Math.round((n % 12) * 10) / 10;
  return `${ft}' ${inches}"`;
}

function GrowthTab({ records, onAdd, onDelete, onError }) {
  const today = new Date().toISOString().slice(0, 10);
  const [recordedDate, setRecordedDate] = useState(today);
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [headIn, setHeadIn] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handleAdd() {
    if (!recordedDate) return;
    setSaving(true);
    try {
      // Convert ft + in to total inches for storage
      const totalHeightIn = (heightFt !== '' || heightIn !== '')
        ? (parseFloat(heightFt || 0) * 12) + parseFloat(heightIn || 0)
        : null;
      await onAdd({
        recordedDate,
        weightLbs: weightLbs !== '' ? parseFloat(weightLbs) : null,
        heightIn: totalHeightIn,
        headIn: headIn !== '' ? parseFloat(headIn) : null,
        notes: notes.trim() || null,
      });
      setWeightLbs('');
      setHeightFt('');
      setHeightIn('');
      setHeadIn('');
      setNotes('');
    } catch (err) {
      onError(err.message || 'Failed to save record');
    }
    setSaving(false);
  }

  // Chart data — sorted oldest first
  const chartData = [...records]
    .sort((a, b) => a.recordedDate < b.recordedDate ? -1 : 1)
    .map(r => ({
      date: r.recordedDate,
      weight: r.weightLbs != null ? parseFloat(r.weightLbs) : undefined,
      height: r.heightIn  != null ? parseFloat(r.heightIn)  : undefined,
      head:   r.headIn    != null ? parseFloat(r.headIn)    : undefined,
    }));

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl lg:col-span-1">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Log Measurement
          </h2>

          <div>
            <Label>Date</Label>
            <Input type="date" value={recordedDate} onChange={e => setRecordedDate(e.target.value)} className="bg-white" />
          </div>
          <div>
            <Label>Weight (lbs)</Label>
            <Input type="number" step="0.01" min="0" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="e.g. 12.5" className="bg-white" />
          </div>
          <div>
            <Label>Height</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input type="number" step="1" min="0" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="ft" className="bg-white" />
              </div>
              <div className="flex-1">
                <Input type="number" step="0.1" min="0" max="11.9" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="in" className="bg-white" />
              </div>
            </div>
          </div>
          <div>
            <Label>Head circumference (in)</Label>
            <Input type="number" step="0.1" min="0" value={headIn} onChange={e => setHeadIn(e.target.value)} placeholder="e.g. 15.5" className="bg-white" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Doctor's comment…" className="bg-white" />
          </div>

          <LoadingButton onClick={handleAdd} loading={saving} loadingText="Saving..." className="w-full bg-emerald-600">
            Save Measurement
          </LoadingButton>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-6">
        {chartData.length >= 2 && (
          <Card className="shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <h3 className="font-bold text-slate-800 mb-4">Growth Chart</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="height" name="Height (in)"  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="head"   name="Head (in)"    stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <h3 className="font-bold text-slate-800 mb-4">Records</h3>
            {!records.length ? (
              <EmptyState label="No measurements yet. Log your first one!" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Weight&nbsp;(lbs)</th>
                      <th className="pb-2 font-medium">Height</th>
                      <th className="pb-2 font-medium">Head&nbsp;(in)</th>
                      <th className="pb-2 font-medium">Notes</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-3 text-slate-700">{r.recordedDate}</td>
                        <td className="py-2 pr-3">{r.weightLbs != null ? `${r.weightLbs} lbs` : '—'}</td>
                        <td className="py-2 pr-3">{inchesToDisplay(r.heightIn)}</td>
                        <td className="py-2 pr-3">{r.headIn != null ? `${r.headIn}"` : '—'}</td>
                        <td className="py-2 pr-3 text-slate-500 max-w-[140px] truncate">{r.notes || ''}</td>
                        <td className="py-2 text-right">
                          {confirmDeleteId === r.id ? (
                            <span className="flex items-center gap-1 justify-end">
                              <span className="text-xs text-slate-500">Delete?</span>
                              <button onClick={() => { onDelete(r.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1">Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-1">No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(r.id)} className="text-slate-300 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Feeding Tracker ────────────────────────────────────────────────────────────

const FEED_TYPES = [
  { value: 'breast_left',  label: 'Breast (L)' },
  { value: 'breast_right', label: 'Breast (R)' },
  { value: 'bottle',       label: 'Bottle' },
  { value: 'formula',      label: 'Formula' },
  { value: 'solids',       label: 'Solids' },
];

const DAYS_OPTIONS = [
  { label: '7d',  value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: 'All', value: 0 },
];

const ACTIVE_FEED_KEY = 'gotcher_active_feed';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function durationSeconds(startedAt, endedAt) {
  return Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000);
}

function FeedingTab({ logs, onStart, onStop, onDelete, onManualAdd, onError }) {
  const [selectedType, setSelectedType] = useState('breast_left');
  const [activeFeed, setActiveFeed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_FEED_KEY)) || null; } catch { return null; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [days, setDays] = useState(7);
  const [displayLogs, setDisplayLogs] = useState(logs);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ type: 'breast_left', date: '', startTime: '', endTime: '' });
  const [manualSaving, setManualSaving] = useState(false);

  // Sync displayLogs from parent when parent refreshes (e.g. after delete/add at default days=7)
  useEffect(() => { if (days === 7) setDisplayLogs(logs); }, [logs]);

  // Tick timer
  useEffect(() => {
    if (!activeFeed) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(activeFeed.startedAt)) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeFeed]);

  async function handleDaysChange(d) {
    setDays(d);
    const url = d === 0 ? '/feeding?days=3650' : `/feeding?days=${d}`;
    const fetched = await apiRequest(url).catch(() => null);
    if (fetched) setDisplayLogs(fetched);
  }

  async function handleManualAdd() {
    if (!manualForm.date || !manualForm.startTime || !manualForm.endTime) return;
    setManualSaving(true);
    try {
      const startedAt = new Date(`${manualForm.date}T${manualForm.startTime}`).toISOString();
      const endedAt   = new Date(`${manualForm.date}T${manualForm.endTime}`).toISOString();
      await onManualAdd({ type: manualForm.type, startedAt, endedAt });
      setShowManual(false);
      setManualForm({ type: 'breast_left', date: '', startTime: '', endTime: '' });
      // refresh display
      const url = days === 0 ? '/feeding?days=3650' : `/feeding?days=${days}`;
      const fetched = await apiRequest(url).catch(() => null);
      if (fetched) setDisplayLogs(fetched);
    } catch (err) {
      onError(err.message || 'Failed to save entry');
    }
    setManualSaving(false);
  }

  async function handleStart() {
    setStarting(true);
    try {
      const log = await onStart(selectedType);
      const active = { id: log.id, type: log.type, startedAt: log.startedAt };
      localStorage.setItem(ACTIVE_FEED_KEY, JSON.stringify(active));
      setActiveFeed(active);
    } catch (err) {
      onError(err.message || 'Failed to start feed');
    }
    setStarting(false);
  }

  async function handleStop() {
    if (!activeFeed) return;
    setStopping(true);
    try {
      const endedAt = new Date().toISOString();
      await onStop(activeFeed.id, endedAt);
      localStorage.removeItem(ACTIVE_FEED_KEY);
      setActiveFeed(null);
    } catch (err) {
      onError(err.message || 'Failed to stop feed');
    }
    setStopping(false);
  }

  // Group today's completed logs
  const today = new Date().toDateString();
  const todayLogs = displayLogs.filter(l => l.endedAt && new Date(l.startedAt).toDateString() === today);
  const totalTodaySeconds = todayLogs.reduce((s, l) => s + durationSeconds(l.startedAt, l.endedAt), 0);

  // Group past days (not today) by date
  const pastLogs = displayLogs.filter(l => l.endedAt && new Date(l.startedAt).toDateString() !== today);
  const grouped = {};
  pastLogs.forEach(l => {
    const d = new Date(l.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(l);
  });

  const typeLabel = v => FEED_TYPES.find(t => t.value === v)?.label ?? v;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Timer card */}
      <Card className="shadow-xl rounded-2xl lg:col-span-1">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-sky-500" /> Feeding Timer
          </h2>

          {!activeFeed ? (
            <>
              <div>
                <Label>Feed type</Label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {FEED_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <LoadingButton onClick={handleStart} loading={starting} loadingText="Starting..." className="w-full bg-sky-600">
                <Timer className="w-4 h-4 mr-2" /> Start Feed
              </LoadingButton>
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-500">{typeLabel(activeFeed.type)}</p>
              <div className="text-5xl font-mono font-bold text-sky-600 tracking-widest">
                {formatDuration(elapsed)}
              </div>
              <LoadingButton onClick={handleStop} loading={stopping} loadingText="Stopping..." className="w-full bg-rose-500 hover:bg-rose-600">
                <StopCircle className="w-4 h-4 mr-2" /> Stop Feed
              </LoadingButton>
            </div>
          )}

          {/* Today summary */}
          {todayLogs.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Today's Feeds</h3>
                <span className="text-xs text-slate-400">{todayLogs.length} feed{todayLogs.length !== 1 ? 's' : ''} · {formatDuration(totalTodaySeconds)} total</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-medium mb-1 px-0.5">
                <span>Type</span>
                <span>Duration</span>
              </div>
              <div className="space-y-1">
                {todayLogs.map(l => (
                  <div key={l.id} className="flex justify-between items-center text-xs text-slate-600">
                    <span>{typeLabel(l.type)}</span>
                    <span>{formatDuration(durationSeconds(l.startedAt, l.endedAt))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual log dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Feeding Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Feed type</Label>
              <select
                value={manualForm.type}
                onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {FEED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start time</Label>
                <Input type="time" value={manualForm.startTime} onChange={e => setManualForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>End time</Label>
                <Input type="time" value={manualForm.endTime} onChange={e => setManualForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <LoadingButton
              onClick={handleManualAdd}
              loading={manualSaving}
              loadingText="Saving..."
              disabled={!manualForm.date || !manualForm.startTime || !manualForm.endTime}
              className="w-full bg-sky-600"
            >
              Save Entry
            </LoadingButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* History */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">History</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {DAYS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleDaysChange(opt.value)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${days === opt.value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Manual Log
            </button>
          </div>
        </div>

        {!displayLogs.filter(l => l.endedAt).length ? (
          <Card><CardContent className="p-0"><EmptyState label="No completed feeds yet. Start your first session!" /></CardContent></Card>
        ) : (
          Object.entries(grouped).map(([date, dayLogs]) => (
            <Card key={date} className="shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">{date}</h4>
                  <span className="text-xs text-slate-400">
                    {dayLogs.length} feed{dayLogs.length !== 1 ? 's' : ''} · {formatDuration(dayLogs.reduce((s, l) => s + durationSeconds(l.startedAt, l.endedAt), 0))} total
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2 border-b pb-1.5">
                  <span className="w-28">Type</span>
                  <span className="flex-1 text-center">Time</span>
                  <span className="w-16 text-right">Duration</span>
                  <span className="w-16"></span>
                </div>
                <div className="space-y-2">
                  {dayLogs.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium w-28">{typeLabel(l.type)}</span>
                      <span className="flex-1 text-center text-slate-500 text-xs">
                        {new Date(l.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-600 w-16 text-right">{formatDuration(durationSeconds(l.startedAt, l.endedAt))}</span>
                      <div className="w-16 text-right">
                        {confirmDeleteId === l.id ? (
                          <span className="flex items-center gap-1 justify-end">
                            <button onClick={() => { onDelete(l.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600 ml-1">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(l.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── Sleep Tracker ──────────────────────────────────────────────────────────────

function SleepTab({ logs, onAdd, onDelete, onError }) {
  const [form, setForm] = useState({ type: 'nap', date: '', startTime: '', endTime: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handleAdd() {
    if (!form.date || !form.startTime || !form.endTime) return;
    setSaving(true);
    try {
      const startedAt = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endedAt   = new Date(`${form.date}T${form.endTime}`).toISOString();
      await onAdd({ type: form.type, startedAt, endedAt, notes: form.notes || null });
      setForm({ type: 'nap', date: '', startTime: '', endTime: '', notes: '' });
    } catch (err) {
      onError(err.message || 'Failed to save sleep entry');
    }
    setSaving(false);
  }

  // Stats
  const byDay = {};
  logs.forEach(l => {
    const d = new Date(l.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDay[d]) byDay[d] = { nap: 0, night: 0, count: 0 };
    const secs = Math.floor((new Date(l.endedAt) - new Date(l.startedAt)) / 1000);
    byDay[d][l.type] += secs;
    byDay[d].count += 1;
  });

  const napLogs   = logs.filter(l => l.type === 'nap');
  const nightLogs = logs.filter(l => l.type === 'night');
  const avgNapSecs = napLogs.length
    ? Math.floor(napLogs.reduce((s, l) => s + (new Date(l.endedAt) - new Date(l.startedAt)) / 1000, 0) / napLogs.length)
    : 0;
  const avgNightSecs = nightLogs.length
    ? Math.floor(nightLogs.reduce((s, l) => s + (new Date(l.endedAt) - new Date(l.startedAt)) / 1000, 0) / nightLogs.length)
    : 0;

  const fmtDuration = secs => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Log form */}
      <Card className="shadow-xl rounded-2xl lg:col-span-1">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-500" /> Log Sleep
          </h2>

          <div>
            <Label>Type</Label>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-slate-200">
              {[{ value: 'nap', label: 'Nap', icon: Sun }, { value: 'night', label: 'Night', icon: Moon }].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm(f => ({ ...f, type: value }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${form.type === value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sleep time</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Wake time</Label>
              <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. restless, woke once"
              className="mt-1"
            />
          </div>

          <LoadingButton
            onClick={handleAdd}
            loading={saving}
            loadingText="Saving..."
            disabled={!form.date || !form.startTime || !form.endTime}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            Save Sleep Entry
          </LoadingButton>

          {/* Stats */}
          {logs.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Averages (last 30 days)</h3>
              {napLogs.length > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-amber-400" /> Avg nap</span>
                  <span className="font-medium">{fmtDuration(avgNapSecs)}</span>
                </div>
              )}
              {nightLogs.length > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Moon className="w-3 h-3 text-indigo-400" /> Avg night</span>
                  <span className="font-medium">{fmtDuration(avgNightSecs)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">Sleep History</h3>

        {!logs.length ? (
          <Card><CardContent className="p-0"><EmptyState label="No sleep entries yet. Log your first session!" /></CardContent></Card>
        ) : (
          Object.entries(byDay).map(([date, totals]) => {
            const dayLogs = logs.filter(l =>
              new Date(l.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === date
            );
            return (
              <Card key={date} className="shadow-md rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">{date}</h4>
                    <div className="flex gap-3 text-xs text-slate-400">
                      {totals.nap > 0 && <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-amber-400" />{fmtDuration(totals.nap)}</span>}
                      {totals.night > 0 && <span className="flex items-center gap-1"><Moon className="w-3 h-3 text-indigo-400" />{fmtDuration(totals.night)}</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dayLogs.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-sm">
                        <span className={`flex items-center gap-1.5 font-medium w-16 ${l.type === 'nap' ? 'text-amber-600' : 'text-indigo-600'}`}>
                          {l.type === 'nap' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                          {l.type === 'nap' ? 'Nap' : 'Night'}
                        </span>
                        <span className="flex-1 text-center text-slate-500 text-xs">
                          {fmtTime(l.startedAt)} → {fmtTime(l.endedAt)}
                        </span>
                        <span className="text-slate-600 w-14 text-right text-xs">
                          {fmtDuration(Math.floor((new Date(l.endedAt) - new Date(l.startedAt)) / 1000))}
                        </span>
                        <div className="w-10 text-right">
                          {confirmDeleteId === l.id ? (
                            <span className="flex items-center gap-1 justify-end">
                              <button onClick={() => { onDelete(l.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700">Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600 ml-1">No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(l.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Poop Tracker ───────────────────────────────────────────────────────────────

const POOP_TYPES        = [{ value: 'normal', label: 'Normal' }, { value: 'loose', label: 'Loose' }, { value: 'hard', label: 'Hard' }];
const POOP_COLORS       = [{ value: 'yellow', label: 'Yellow' }, { value: 'brown', label: 'Brown' }, { value: 'green', label: 'Green' }, { value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }, { value: 'white', label: 'White' }, { value: 'orange', label: 'Orange' }];
const POOP_CONSISTENCY  = [{ value: 'normal', label: 'Normal' }, { value: 'watery', label: 'Watery' }, { value: 'seedy', label: 'Seedy' }, { value: 'mucusy', label: 'Mucusy' }, { value: 'hard', label: 'Hard' }];

function PoopTab({ logs, onAdd, onDelete, onError }) {
  const [form, setForm] = useState({ date: '', time: '', type: 'normal', color: '', consistency: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  async function handleAdd() {
    if (!form.date || !form.time) return;
    setSaving(true);
    try {
      const loggedAt = new Date(`${form.date}T${form.time}`).toISOString();
      await onAdd({
        loggedAt,
        type: form.type || 'normal',
        color: form.color || null,
        consistency: form.consistency || null,
        notes: form.notes || null,
      });
      setForm({ date: '', time: '', type: 'normal', color: '', consistency: '', notes: '' });
    } catch (err) {
      onError(err.message || 'Failed to save entry');
    }
    setSaving(false);
  }

  const byDay = {};
  logs.forEach(l => {
    const d = new Date(l.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(l);
  });

  const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-amber-500" /> Poop Color & Consistency Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1 text-sm">
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Colors</h3>
              <div className="space-y-2">
                {[
                  { dot: 'bg-yellow-400',  label: 'Yellow',      text: 'Normal for breastfed babies — classic mustard yellow is a healthy sign.' },
                  { dot: 'bg-amber-700',   label: 'Brown',       text: 'Normal, especially for formula-fed babies or when solids are introduced.' },
                  { dot: 'bg-green-500',   label: 'Green',       text: 'Often normal, but can indicate a foremilk/hindmilk imbalance, fast letdown, or sensitivity to something in mom\'s diet. Also common when introducing green veggies.' },
                  { dot: 'bg-orange-400',  label: 'Orange',      text: 'Usually normal — common after introducing orange purees like carrots or sweet potato.' },
                  { dot: 'bg-slate-800',   label: 'Black',       text: 'Normal in the first 1–2 days (meconium). After that, contact your doctor — can indicate bleeding in the upper GI tract.', warn: true },
                  { dot: 'bg-red-500',     label: 'Red',         text: 'May be dietary (beets, red foods), but should be evaluated — can indicate lower GI bleeding or an anal fissure.', warn: true },
                  { dot: 'bg-slate-200',   label: 'White/Pale',  text: 'Always contact your doctor — can indicate a liver or bile duct problem.', warn: true },
                ].map(({ dot, label, text, warn }) => (
                  <div key={label} className="flex gap-3 items-start">
                    <span className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${dot} border border-slate-200`} />
                    <p className={warn ? 'text-slate-700' : 'text-slate-600'}>
                      <span className="font-medium">{label}</span>
                      {warn && <span className="ml-1 text-xs font-semibold text-red-500 uppercase tracking-wide">⚠ See doctor</span>}
                      {' — '}{text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-slate-700 mb-2">Consistency</h3>
              <div className="space-y-2">
                {[
                  { label: 'Normal',  text: 'Soft and formed — healthy baseline, especially on formula or solids.' },
                  { label: 'Seedy',   text: 'Normal for breastfed babies — the little seed-like flecks are undigested milk proteins.' },
                  { label: 'Watery',  text: 'May indicate diarrhea. Watch for signs of dehydration if it persists more than a day or two.' },
                  { label: 'Mucusy', text: 'Can signal intestinal irritation, a cold (babies swallow mucus), or a food sensitivity.' },
                  { label: 'Hard',    text: 'Constipation — common when switching formulas or introducing solids.' },
                ].map(({ label, text }) => (
                  <div key={label} className="flex gap-3 items-start">
                    <span className="mt-1 w-3 h-3 rounded-full flex-shrink-0 bg-amber-200 border border-amber-300" />
                    <p className="text-slate-600"><span className="font-medium">{label}</span>{' — '}{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 border-t pt-3">
              This guide is for informational purposes only. Always consult your pediatrician if you're concerned.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log form */}
      <Card className="shadow-xl rounded-2xl lg:col-span-1">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-amber-500" /> Log Poop
            </h2>
            <button
              onClick={() => setShowHelp(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Color guide"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {POOP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <Label>Color <span className="text-slate-400 font-normal">(optional)</span></Label>
            <select
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— select —</option>
              {POOP_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <Label>Consistency <span className="text-slate-400 font-normal">(optional)</span></Label>
            <select
              value={form.consistency}
              onChange={e => setForm(f => ({ ...f, consistency: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— select —</option>
              {POOP_CONSISTENCY.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <Label>Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any observations..."
              className="mt-1"
            />
          </div>

          <LoadingButton
            onClick={handleAdd}
            loading={saving}
            loadingText="Saving..."
            disabled={!form.date || !form.time}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            Log Poop
          </LoadingButton>
        </CardContent>
      </Card>

      {/* History */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">Poop History</h3>

        {!logs.length ? (
          <Card><CardContent className="p-0"><EmptyState label="No poop logs yet. Log the first one!" /></CardContent></Card>
        ) : (
          Object.entries(byDay).map(([date, dayLogs]) => (
            <Card key={date} className="shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">{date}</h4>
                  <span className="text-xs text-slate-400">{dayLogs.length} poop{dayLogs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2 border-b pb-1.5">
                  <span className="w-16">Time</span>
                  <span className="w-20">Type</span>
                  <span className="w-20">Color</span>
                  <span className="flex-1">Consistency</span>
                  <span className="w-10"></span>
                </div>
                <div className="space-y-2">
                  {dayLogs.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 text-xs w-16">{fmtTime(l.loggedAt)}</span>
                      <span className="text-slate-700 w-20 capitalize">{l.type}</span>
                      <span className="text-slate-600 w-20 capitalize">{l.color || '—'}</span>
                      <span className="text-slate-600 flex-1 capitalize">{l.consistency || '—'}</span>
                      <div className="w-10 text-right">
                        {confirmDeleteId === l.id ? (
                          <span className="flex items-center gap-1 justify-end">
                            <button onClick={() => { onDelete(l.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600 ml-1">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(l.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── Marketplace — Coming Soon ──────────────────────────────────────────────────
function MarketplaceTab() {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <ShoppingBag className="w-12 h-12 text-fuchsia-200" />
        <h3 className="font-semibold text-xl text-slate-700">Marketplace — Coming Soon</h3>
        <p className="text-slate-500 max-w-xs text-sm">
          Buy and sell baby items with other parents in your community. This feature is in the works!
        </p>
      </CardContent>
    </Card>
  );
}

// ── Playdates — Coming Soon ────────────────────────────────────────────────────
function PlaydatesTab() {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Users className="w-12 h-12 text-fuchsia-200" />
        <h3 className="font-semibold text-xl text-slate-700">Playdates — Coming Soon</h3>
        <p className="text-slate-500 max-w-xs text-sm">
          Find other families nearby to schedule playdates. This feature is in the works!
        </p>
      </CardContent>
    </Card>
  );
}

// ── Activities ─────────────────────────────────────────────────────────────────
function ActivitiesTab({ activities, week, months, birthdate, babyName }) {
  if (!birthdate) {
    return (
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <Baby className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Set Baby's Birthdate First</h3>
          <p className="text-slate-600">Go to the Dashboard tab and enter a birthdate to see age-appropriate activities and product recommendations!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">Activities for {babyName || "Baby"}</h2>
          <p className="text-slate-600 mb-4">Age: {months} months ({week} weeks)</p>

          {!activities.length ? (
            <EmptyState label="Loading activities..." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activities.map((a, i) => (
                <div key={i} className="p-5 rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 border-2 border-sky-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-sky-700">{i + 1}</span>
                    </div>
                    <p className="text-slate-700">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <ShoppingBag className="w-10 h-10 text-fuchsia-200" />
          <h3 className="font-semibold text-lg text-slate-700">Recommended Products — Coming Soon</h3>
          <p className="text-slate-500 max-w-xs text-sm">
            Curated product picks for your baby's age and stage. This feature is in the works!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Appointments ───────────────────────────────────────────────────────────────
function AppointmentTab({ appointments, onAdd, onUpdate, onDelete, onError }) {
  const [form, setForm] = useState({ appointmentDate: '', doctorName: '', appointmentType: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.appointmentDate) { onError('Appointment date is required'); return; }
    setSaving(true);
    try {
      await onAdd({ ...form, isCompleted: false });
      setForm({ appointmentDate: '', doctorName: '', appointmentType: '', notes: '' });
    } catch {
      onError('Failed to save appointment');
    }
    setSaving(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter(a => a.appointmentDate >= today && !a.isCompleted);
  const past = appointments.filter(a => a.appointmentDate < today || a.isCompleted);

  function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Add form */}
      <Card className="shadow-xl rounded-2xl md:col-span-1">
        <CardContent className="p-5">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            Add Appointment
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.appointmentDate}
                onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))}
                className="bg-white"
                required
              />
            </div>
            <div>
              <Label>Doctor / Provider</Label>
              <Input
                value={form.doctorName}
                onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))}
                placeholder="e.g., Dr. Smith"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Appointment Type</Label>
              <Input
                value={form.appointmentType}
                onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))}
                placeholder="e.g., 2-Month Checkup"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                rows={3}
                className="bg-white"
              />
            </div>
            <LoadingButton loading={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Save Appointment
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <div className="md:col-span-2 space-y-5">
        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming appointments</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(a => (
                  <AppointmentRow key={a.id} appt={a} fmtDate={fmtDate} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-500 mb-3">
              Past / Completed ({past.length})
            </h3>
            {past.length === 0 ? (
              <p className="text-sm text-slate-400">None yet</p>
            ) : (
              <div className="space-y-2">
                {[...past].reverse().map(a => (
                  <AppointmentRow key={a.id} appt={a} fmtDate={fmtDate} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AppointmentRow({ appt, fmtDate, onUpdate, onDelete, onError }) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleMarkDone() {
    setMarking(true);
    try {
      await onUpdate(appt.id, { isCompleted: true });
    } catch {
      onError('Failed to update appointment');
    }
    setMarking(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(appt.id);
    } catch {
      onError('Failed to delete appointment');
    }
    setDeleting(false);
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${appt.isCompleted ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-emerald-700 text-sm">{fmtDate(appt.appointmentDate)}</span>
          {appt.appointmentType && <span className="text-slate-700 text-sm">{appt.appointmentType}</span>}
          {appt.doctorName && <span className="text-slate-500 text-xs">· {appt.doctorName}</span>}
          {appt.isCompleted && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">Done</span>}
        </div>
        {appt.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{appt.notes}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!appt.isCompleted && (
          <button
            onClick={handleMarkDone}
            disabled={marking}
            className="text-xs text-emerald-700 border border-emerald-300 rounded px-2 py-1 hover:bg-emerald-100 disabled:opacity-50"
          >
            {marking ? '…' : 'Mark Done'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-slate-400 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const FIRST_TIME_PRESETS = [
  'Smile', 'Laugh', 'Solid food', 'Steps', 'Word',
  'Haircut', 'Swim', 'Trip', 'Tooth', 'Rolled over',
];

function FirstTimesTab({ firsts, babyName, onAdd, onUpdate, onDelete, onUpload, onError }) {
  const [mode, setMode] = useState('suggestions'); // 'suggestions' | 'custom'
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!label.trim()) { onError('Label is required'); return; }
    if (!date) { onError('Date is required'); return; }
    setSaving(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        setUploadingPhoto(true);
        const form = new FormData();
        form.append('file', imageFile);
        const res = await onUpload(form);
        imageUrl = res.url;
        setUploadingPhoto(false);
      }
      await onAdd({ label: label.trim(), occurredDate: date, imageUrl, notes: notes.trim() || null });
      setLabel('');
      setDate('');
      setNotes('');
      setImageFile(null);
      setMode('suggestions');
    } catch (e) {
      onError('Failed to save first time');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold text-slate-700">Add a First</h3>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('suggestions')}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${mode === 'suggestions' ? 'bg-pink-100 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              Suggestions
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${mode === 'custom' ? 'bg-pink-100 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
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
                  className="text-sm px-3 py-1 rounded-full bg-slate-100 hover:bg-pink-100 hover:text-pink-700 border border-slate-200 transition-colors"
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
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-500">Date</Label>
              <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Photo (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files[0] || null)}
                className="text-xs"
              />
            </div>
          </div>

          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />

          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !date}
            className="w-full py-2 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 disabled:opacity-50 transition-colors"
          >
            {saving ? (uploadingPhoto ? 'Uploading photo…' : 'Saving…') : 'Save First'}
          </button>
        </CardContent>
      </Card>

      {/* List */}
      {firsts.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">No firsts recorded yet. Add one above!</p>
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
  );
}

function FirstTimeCard({ ft, babyName, onUpdate, onDelete, onUpload, onError }) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(ft.label);
  const [editDate, setEditDate] = useState(ft.occurredDate);
  const [editNotes, setEditNotes] = useState(ft.notes || '');
  const [editImageFile, setEditImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  function handleStartEdit() {
    setEditLabel(ft.label);
    setEditDate(ft.occurredDate);
    setEditNotes(ft.notes || '');
    setEditImageFile(null);
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
      let imageUrl = undefined; // undefined = don't update
      if (editImageFile) {
        setUploadingPhoto(true);
        const form = new FormData();
        form.append('file', editImageFile);
        const res = await onUpload(form);
        imageUrl = res.url;
        setUploadingPhoto(false);
      }
      const patch = { label: editLabel.trim(), occurredDate: editDate, notes: editNotes.trim() || null };
      if (imageUrl !== undefined) patch.imageUrl = imageUrl;
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

  return (
    <Card className="overflow-hidden">
      {ft.imageUrl && (
        <img src={ft.imageUrl} alt={ft.label} className="w-full h-48 object-cover" />
      )}
      <CardContent className="pt-3 space-y-2">
        {editing ? (
          <div className="space-y-2">
            <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={120} />
            <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Notes" />
            <div>
              <Label className="text-xs text-slate-500">{ft.imageUrl ? 'Replace photo (optional)' : 'Add photo (optional)'}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setEditImageFile(e.target.files[0] || null)}
                className="text-xs"
              />
              {editImageFile && <p className="text-xs text-slate-500 mt-0.5">{editImageFile.name}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editLabel.trim() || !editDate}
                className="flex-1 py-1.5 rounded-lg bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 disabled:opacity-50"
              >
                {saving ? (uploadingPhoto ? 'Uploading…' : 'Saving…') : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800 text-lg leading-tight">{ft.label}</p>
                <p className="text-sm text-slate-500">{fmtDate(ft.occurredDate)}</p>
                {ft.notes && <p className="text-sm text-slate-600 mt-1">{ft.notes}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <button
                  onClick={handleShare}
                  title="Share"
                  className="text-slate-400 hover:text-pink-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <button onClick={handleStartEdit} title="Edit" className="text-slate-400 hover:text-blue-500">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} disabled={deleting} title="Delete" className="text-slate-400 hover:text-red-500 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {copied && <p className="text-xs text-emerald-600 font-medium">Copied to clipboard!</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── PillNav ────────────────────────────────────────────────────────────────────
function PillNav({ options, active, onChange }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            active === o.value
              ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
