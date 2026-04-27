import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Moon, Sun, Trash2 } from "lucide-react";
import { fmtDuration } from "@/lib/formatting";

export default function SleepTab({ logs, onAdd, onDelete, onError }) {
  const [form, setForm] = useState({ type: 'nap', date: '', startTime: '', endTime: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handleAdd() {
    if (!form.date || !form.startTime || !form.endTime) return;
    setSaving(true);
    try {
      const startedAt = new Date(`${form.date}T${form.startTime}`);
      let endedAt     = new Date(`${form.date}T${form.endTime}`);
      if (endedAt <= startedAt) endedAt.setDate(endedAt.getDate() + 1);
      await onAdd({ type: form.type, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), notes: form.notes || null });
      setForm({ type: 'nap', date: '', startTime: '', endTime: '', notes: '' });
    } catch (err) {
      onError(err.message || 'Failed to save sleep entry');
    }
    setSaving(false);
  }

  const byDay = {};
  logs.forEach(l => {
    const d = new Date(l.startedAt).toISOString().slice(0, 10);
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

  const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-xl font-bold text-slate-800 flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" /> Log Sleep
          </h2>

          <div>
            <Label>Type</Label>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-slate-200">
              {[{ value: 'nap', label: 'Nap', icon: Sun }, { value: 'night', label: 'Night', icon: Moon }].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm(f => ({ ...f, type: value }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${form.type === value ? 'bg-primary text-primary-foreground' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
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
            className="w-full"
          >
            Save Sleep Entry
          </LoadingButton>

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
                  <span className="flex items-center gap-1"><Moon className="w-3 h-3 text-primary/60" /> Avg night</span>
                  <span className="font-medium">{fmtDuration(avgNightSecs)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        <h3 className="font-display text-lg font-bold text-slate-800">Sleep History</h3>

        {!logs.length ? (
          <Card><CardContent className="p-0"><EmptyState label="No sleep entries yet. Log your first session!" /></CardContent></Card>
        ) : (
          Object.entries(byDay).map(([date, totals]) => {
            const dayLogs = logs.filter(l =>
              new Date(l.startedAt).toISOString().slice(0, 10) === date
            );
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <Card key={date} className="shadow-md rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">{dateLabel}</h4>
                    <div className="flex gap-3 text-xs text-slate-400">
                      {totals.nap > 0 && <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-amber-400" />{fmtDuration(totals.nap)}</span>}
                      {totals.night > 0 && <span className="flex items-center gap-1"><Moon className="w-3 h-3 text-primary/60" />{fmtDuration(totals.night)}</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dayLogs.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-sm">
                        <span className={`flex items-center gap-1.5 font-medium w-16 ${l.type === 'nap' ? 'text-amber-600' : 'text-primary'}`}>
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
