import React, { useState, useEffect } from "react";
import PillNav from "@/components/ui/PillNav";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, TrendingUp, CheckCircle2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { MILESTONES, VACCINES } from "@/lib/babyData";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getPercentileData } from "@/lib/growthPercentiles";

export default function HealthTab({ growth, vaccines, appointments, data, week, sex, onAddGrowth, onDeleteGrowth, onToggleVaccine, onAddAppointment, onUpdateAppointment, onDeleteAppointment, onToggleMilestone, onError, healthView, onHealthViewChange }) {
  const [view, setView] = useState('growth');

  useEffect(() => {
    if (healthView !== undefined) setView(healthView);
  }, [healthView]);

  function handleViewChange(v) {
    setView(v);
    onHealthViewChange?.(v);
  }

  return (
    <>
      <PillNav
        options={[
          { value: 'growth',       label: 'Growth' },
          { value: 'vaccines',     label: 'Vaccines' },
          { value: 'appointments', label: 'Appointments' },
          { value: 'milestones',   label: 'Milestones' },
        ]}
        active={view}
        onChange={handleViewChange}
      />
      {view === 'growth'       && <GrowthTab records={growth} birthdate={data?.profile?.birthdate} sex={sex} onAdd={onAddGrowth} onDelete={onDeleteGrowth} onError={onError} />}
      {view === 'vaccines'     && <VaccineTab vaccines={vaccines} onToggle={onToggleVaccine} />}
      {view === 'appointments' && <AppointmentTab appointments={appointments} onAdd={onAddAppointment} onUpdate={onUpdateAppointment} onDelete={onDeleteAppointment} onError={onError} />}
      {view === 'milestones'   && <MilestonesTab data={data} week={week} onToggle={onToggleMilestone} />}
    </>
  );
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

// ── Growth Tracker ─────────────────────────────────────────────────────────────

function inchesToDisplay(totalIn) {
  if (totalIn == null) return '—';
  const n = parseFloat(totalIn);
  const ft = Math.floor(n / 12);
  const inches = Math.round((n % 12) * 10) / 10;
  return `${ft}' ${inches}"`;
}

/** Compute age in fractional months given a birthdate string and a record date string. */
function ageInMonths(birthdate, recordedDate) {
  const birth = new Date(birthdate + 'T00:00:00');
  const rec   = new Date(recordedDate + 'T00:00:00');
  const msPerMonth = 365.25 / 12 * 86400 * 1000;
  return Math.round(((rec - birth) / msPerMonth) * 10) / 10;
}

/**
 * Merge baby measurement points and WHO percentile points into a single array
 * sorted by X value (month or date string). This is the standard Recharts
 * approach — one data array on the chart, each series uses its own dataKey.
 */
function buildChartData(babyData, percData) {
  const byX = {};

  if (percData) {
    percData.forEach(p => {
      byX[p.x] = { x: p.x, p5: p.p5, p50: p.p50, p95: p.p95 };
    });
  }

  babyData.forEach(b => {
    if (byX[b.x] !== undefined) {
      byX[b.x].y = b.y;
    } else {
      byX[b.x] = { x: b.x, y: b.y };
    }
  });

  return Object.values(byX).sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));
}

/** Render a single metric chart with optional WHO percentile overlay. */
function MetricChart({ title, color, babyData, percData, yLabel, xLabel }) {
  if (babyData.length < 1 && !percData) return null;

  const chartData = buildChartData(babyData, percData);

  return (
    <Card className="shadow-md rounded-2xl">
      <CardContent className="p-5">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">{title}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="x"
              type="number"
              domain={percData ? [0, 24] : ['dataMin', 'dataMax']}
              tick={{ fontSize: 10 }}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' } : undefined}
              height={xLabel ? 32 : 20}
            />
            <YAxis tick={{ fontSize: 10 }} width={36} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip
              formatter={(val, name) => val != null ? [val.toFixed(1), name] : [null, name]}
              labelFormatter={x => xLabel ? `${x} mo` : x}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {/* WHO percentile reference bands */}
            {percData && (
              <>
                <Line dataKey="p5"  name="5th %ile"  stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
                <Line dataKey="p50" name="50th %ile" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
                <Line dataKey="p95" name="95th %ile" stroke="#86efac" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
              </>
            )}

            {/* Baby's actual measurements */}
            <Line dataKey="y" name={title} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls legendType="line" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function GrowthTab({ records, birthdate, sex, onAdd, onDelete, onError }) {
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

  // Determine if we can show age-based charts with percentile overlay
  const hasBirthdate = !!birthdate;

  // Build per-metric baby data arrays
  const sorted = [...records].sort((a, b) => a.recordedDate < b.recordedDate ? -1 : 1);

  let weightBaby = [], heightBaby = [], headBaby = [];
  if (hasBirthdate) {
    // X axis = age in months
    sorted.forEach(r => {
      const mo = ageInMonths(birthdate, r.recordedDate);
      if (mo < 0) return; // before birth — skip
      if (r.weightLbs != null) weightBaby.push({ x: mo, y: parseFloat(r.weightLbs) });
      if (r.heightIn  != null) heightBaby.push({ x: mo, y: parseFloat(r.heightIn) });
      if (r.headIn    != null) headBaby.push({ x: mo, y: parseFloat(r.headIn) });
    });
  } else {
    // X axis = date string (fallback, no percentile lines)
    sorted.forEach(r => {
      if (r.weightLbs != null) weightBaby.push({ x: r.recordedDate, y: parseFloat(r.weightLbs) });
      if (r.heightIn  != null) heightBaby.push({ x: r.recordedDate, y: parseFloat(r.heightIn) });
      if (r.headIn    != null) headBaby.push({ x: r.recordedDate, y: parseFloat(r.headIn) });
    });
  }

  // Percentile data (only when birthdate known and baby <= 24 months)
  let weightPerc = null, heightPerc = null, headPerc = null;
  if (hasBirthdate) {
    const currentAgeMonths = ageInMonths(birthdate, today);
    if (currentAgeMonths <= 36) { // show for up to 3 years (WHO data only goes to 24 mo, curves stop there)
      weightPerc = getPercentileData('weight', sex).map(p => ({ ...p, x: p.month }));
      heightPerc = getPercentileData('length', sex).map(p => ({ ...p, x: p.month }));
      headPerc   = getPercentileData('head',   sex).map(p => ({ ...p, x: p.month }));
    }
  }

  const showCharts = records.length >= 1;
  const xLabel = hasBirthdate ? 'Age (months)' : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Log form */}
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

          {!hasBirthdate && (
            <p className="text-xs text-slate-400 text-center">Set a birthdate in Dashboard to see WHO percentile curves</p>
          )}
        </CardContent>
      </Card>

      {/* Charts + records */}
      <div className="lg:col-span-2 space-y-4">
        {showCharts && (
          <>
            <MetricChart
              title="Weight (lbs)"
              color="#10b981"
              babyData={weightBaby}
              percData={weightPerc}
              yLabel="lbs"
              xLabel={xLabel}
            />
            <MetricChart
              title="Height (in)"
              color="#3b82f6"
              babyData={heightBaby}
              percData={heightPerc}
              yLabel="in"
              xLabel={xLabel}
            />
            <MetricChart
              title="Head circumference (in)"
              color="#a855f7"
              babyData={headBaby}
              percData={headPerc}
              yLabel="in"
              xLabel={xLabel}
            />
          </>
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
