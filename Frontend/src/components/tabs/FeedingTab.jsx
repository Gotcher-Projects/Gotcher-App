import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Utensils, Timer, StopCircle, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { formatDuration } from "@/lib/formatting";

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

const OZ_TYPES = new Set(['bottle', 'formula', 'solids']);

function durationSeconds(startedAt, endedAt) {
  return Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000);
}

const mlToOz = ml => ml ? (ml / 29.5735).toFixed(1) + ' oz' : null;

export default function FeedingTab({ logs, onStart, onStop, onDelete, onManualAdd, onError }) {
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
  const [manualForm, setManualForm] = useState({ type: 'breast_left', date: '', startTime: '', endTime: '', oz: '' });
  const [manualSaving, setManualSaving] = useState(false);
  const [quickOz, setQuickOz] = useState('');
  const [quickTime, setQuickTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [quickLogging, setQuickLogging] = useState(false);

  useEffect(() => { setDisplayLogs(logs); }, [logs]);

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
      await onManualAdd({ type: manualForm.type, startedAt, endedAt, oz: parseFloat(manualForm.oz) || null });
      setShowManual(false);
      setManualForm({ type: 'breast_left', date: '', startTime: '', endTime: '', oz: '' });
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

  async function handleQuickLog() {
    setQuickLogging(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const startedAt = new Date(`${today}T${quickTime}`).toISOString();
      await onManualAdd({ type: selectedType, startedAt, endedAt: startedAt, oz: parseFloat(quickOz) || null });
      setQuickOz('');
      setQuickTime(new Date().toTimeString().slice(0, 5));
      const url = days === 0 ? '/feeding?days=3650' : `/feeding?days=${days}`;
      const fetched = await apiRequest(url).catch(() => null);
      if (fetched) setDisplayLogs(fetched);
    } catch (err) {
      onError(err.message || 'Failed to log feeding');
    }
    setQuickLogging(false);
  }

  const today = new Date().toDateString();
  const todayLogs = displayLogs.filter(l => l.endedAt && new Date(l.startedAt).toDateString() === today);
  const totalTodaySeconds = todayLogs.reduce((s, l) => s + durationSeconds(l.startedAt, l.endedAt), 0);

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
      <Card className="shadow-xl rounded-2xl lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" /> {OZ_TYPES.has(selectedType) ? 'Log Feeding' : 'Feeding Timer'}
          </h2>

          <div>
            <Label>Feed type</Label>
            <select
              value={selectedType}
              onChange={e => { setSelectedType(e.target.value); if (activeFeed) { localStorage.removeItem(ACTIVE_FEED_KEY); setActiveFeed(null); } }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {FEED_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {OZ_TYPES.has(selectedType) ? (
            <>
              <div>
                <Label>Amount (oz)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 4"
                  value={quickOz}
                  onChange={e => setQuickOz(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={quickTime}
                  onChange={e => setQuickTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <LoadingButton onClick={handleQuickLog} loading={quickLogging} loadingText="Logging..." className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Log Feeding
              </LoadingButton>
            </>
          ) : !activeFeed ? (
            <LoadingButton onClick={handleStart} loading={starting} loadingText="Starting..." className="w-full">
              <Timer className="w-4 h-4 mr-2" /> Start Feed
            </LoadingButton>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{typeLabel(activeFeed.type)}</p>
              <div className="text-5xl font-mono font-bold text-primary tracking-widest">
                {formatDuration(elapsed)}
              </div>
              <LoadingButton onClick={handleStop} loading={stopping} loadingText="Stopping..." className="w-full bg-rose-500 hover:bg-rose-600">
                <StopCircle className="w-4 h-4 mr-2" /> Stop Feed
              </LoadingButton>
            </div>
          )}

          {todayLogs.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">Today's Feeds</h3>
                <span className="text-xs text-muted-foreground">{todayLogs.length} feed{todayLogs.length !== 1 ? 's' : ''} · {formatDuration(totalTodaySeconds)} total</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-medium mb-1 px-0.5">
                <span>Type</span>
                <span>Duration</span>
              </div>
              <div className="space-y-1">
                {todayLogs.map(l => (
                  <div key={l.id} className="flex justify-between items-center text-xs text-foreground">
                    <span>{typeLabel(l.type)}</span>
                    <span>{mlToOz(l.amountMl) ?? formatDuration(durationSeconds(l.startedAt, l.endedAt))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            {OZ_TYPES.has(manualForm.type) && (
              <div>
                <Label>Amount (oz)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 4"
                  value={manualForm.oz}
                  onChange={e => setManualForm(f => ({ ...f, oz: e.target.value }))}
                  className="mt-1"
                />
              </div>
            )}
            <LoadingButton
              onClick={handleManualAdd}
              loading={manualSaving}
              loadingText="Saving..."
              disabled={!manualForm.date || !manualForm.startTime || !manualForm.endTime}
              className="w-full"
            >
              Save Entry
            </LoadingButton>
          </div>
        </DialogContent>
      </Dialog>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">History</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border">
              {DAYS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleDaysChange(opt.value)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${days === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
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
                  <h4 className="font-semibold text-foreground">{date}</h4>
                  <span className="text-xs text-muted-foreground">
                    {dayLogs.length} feed{dayLogs.length !== 1 ? 's' : ''} · {formatDuration(dayLogs.reduce((s, l) => s + durationSeconds(l.startedAt, l.endedAt), 0))} total
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-2 border-b border-border pb-1.5">
                  <span className="w-28">Type</span>
                  <span className="flex-1 text-center">Time</span>
                  <span className="w-16 text-right">Duration</span>
                  <span className="w-16"></span>
                </div>
                <div className="space-y-2">
                  {dayLogs.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium w-28">{typeLabel(l.type)}</span>
                      <span className="flex-1 text-center text-muted-foreground text-xs">
                        {new Date(l.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="text-muted-foreground w-16 text-right">{mlToOz(l.amountMl) ?? formatDuration(durationSeconds(l.startedAt, l.endedAt))}</span>
                      <div className="w-16 text-right">
                        {confirmDeleteId === l.id ? (
                          <span className="flex items-center gap-1 justify-end">
                            <button onClick={() => { onDelete(l.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground ml-1">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(l.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
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
