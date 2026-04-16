import React, { useState, useEffect } from "react";
import PillNav from "@/components/ui/PillNav";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Utensils, Timer, StopCircle, Moon, Sun, Droplets, HelpCircle, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function TrackTab({ feeding, sleep, poop, onStart, onStop, onDeleteFeed, onManualAdd, onAddSleep, onDeleteSleep, onAddPoop, onDeletePoop, onError }) {
  const [view, setView] = useState('feeding');

  return (
    <>
      <PillNav
        options={[
          { value: 'feeding', label: 'Feeding' },
          { value: 'sleep',   label: 'Sleep' },
          { value: 'poop',    label: 'Poop' },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'feeding' && <FeedingTab logs={feeding} onStart={onStart} onStop={onStop} onDelete={onDeleteFeed} onManualAdd={onManualAdd} onError={onError} />}
      {view === 'sleep'   && <SleepTab logs={sleep} onAdd={onAddSleep} onDelete={onDeleteSleep} onError={onError} />}
      {view === 'poop'    && <PoopTab logs={poop} onAdd={onAddPoop} onDelete={onDeletePoop} onError={onError} />}
    </>
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
