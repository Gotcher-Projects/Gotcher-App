import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Droplets, HelpCircle, Trash2 } from "lucide-react";

const DIAPER_TYPES       = [{ value: 'normal', label: 'Normal' }, { value: 'loose', label: 'Loose' }, { value: 'hard', label: 'Hard' }];
const DIAPER_COLORS      = [{ value: 'yellow', label: 'Yellow' }, { value: 'brown', label: 'Brown' }, { value: 'green', label: 'Green' }, { value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }, { value: 'white', label: 'White' }, { value: 'orange', label: 'Orange' }];
const DIAPER_CONSISTENCY = [{ value: 'normal', label: 'Normal' }, { value: 'watery', label: 'Watery' }, { value: 'seedy', label: 'Seedy' }, { value: 'mucusy', label: 'Mucusy' }, { value: 'hard', label: 'Hard' }];

const EMPTY_FORM = { date: '', time: '', category: 'poop', type: 'normal', color: '', consistency: '', notes: '' };

export default function DiaperTab({ logs, onAdd, onDelete, onError }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const isPee = form.category === 'pee';

  async function handleAdd() {
    if (!form.date || !form.time) return;
    setSaving(true);
    try {
      const loggedAt = new Date(`${form.date}T${form.time}`).toISOString();
      const payload = { loggedAt, category: form.category, notes: form.notes || null };
      if (!isPee) {
        payload.type = form.type || 'normal';
        payload.color = form.color || null;
        payload.consistency = form.consistency || null;
      }
      await onAdd(payload);
      setForm(EMPTY_FORM);
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
                  { dot: 'bg-green-500',   label: 'Green',       text: "Often normal, but can indicate a foremilk/hindmilk imbalance, fast letdown, or sensitivity to something in mom's diet. Also common when introducing green veggies." },
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

      <Card className="shadow-xl rounded-2xl lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-slate-800 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-amber-500" /> Log Diaper
            </h2>
            {!isPee && (
              <button
                onClick={() => setShowHelp(true)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Color guide"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <div>
            <Label>Category</Label>
            <div className="mt-1 flex gap-2">
              {[{ value: 'poop', label: 'Poop' }, { value: 'pee', label: 'Pee' }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: opt.value }))}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    form.category === opt.value
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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

          {!isPee && (
            <>
              <div>
                <Label>Type</Label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {DIAPER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                  {DIAPER_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
                  {DIAPER_CONSISTENCY.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </>
          )}

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
            Log Diaper
          </LoadingButton>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        <h3 className="font-display text-lg font-bold text-slate-800">Diaper History</h3>

        {!logs.length ? (
          <Card><CardContent className="p-0"><EmptyState label="No diaper logs yet. Log the first one!" /></CardContent></Card>
        ) : (
          Object.entries(byDay).map(([date, dayLogs]) => (
            <Card key={date} className="shadow-md rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">{date}</h4>
                  <span className="text-xs text-slate-400">{dayLogs.length} diaper{dayLogs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2 border-b pb-1.5">
                  <span className="w-16">Time</span>
                  <span className="w-16">Category</span>
                  <span className="w-20">Type</span>
                  <span className="w-20">Color</span>
                  <span className="flex-1">Consistency</span>
                  <span className="w-10"></span>
                </div>
                <div className="space-y-2">
                  {dayLogs.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 text-xs w-16">{fmtTime(l.loggedAt)}</span>
                      <span className="w-16 capitalize">{l.category === 'pee'
                        ? <span className="text-sky-500 font-medium">Pee</span>
                        : <span className="text-amber-600 font-medium">Poop</span>
                      }</span>
                      <span className="text-slate-700 w-20 capitalize">{l.type || '—'}</span>
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
