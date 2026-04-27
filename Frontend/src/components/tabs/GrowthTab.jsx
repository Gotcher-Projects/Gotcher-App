import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingUp, Trash2 } from "lucide-react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getPercentileData } from "@/lib/growthPercentiles";
import { useTheme } from "@/contexts/ThemeContext";

function inchesToDisplay(totalIn) {
  if (totalIn == null) return '—';
  const n = parseFloat(totalIn);
  const ft = Math.floor(n / 12);
  const inches = Math.round((n % 12) * 10) / 10;
  return `${ft}' ${inches}"`;
}

function ageInMonths(birthdate, recordedDate) {
  const birth = new Date(birthdate + 'T00:00:00');
  const rec   = new Date(recordedDate + 'T00:00:00');
  const msPerMonth = 365.25 / 12 * 86400 * 1000;
  return Math.round(((rec - birth) / msPerMonth) * 10) / 10;
}

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

function MetricChart({ title, color, babyData, percData, yLabel, xLabel }) {
  if (babyData.length < 1 && !percData) return null;

  const chartData = buildChartData(babyData, percData);

  return (
    <Card className="shadow-md rounded-2xl">
      <CardContent className="p-5">
        <h3 className="font-semibold text-foreground mb-3 text-sm">{title}</h3>
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

            {percData && (
              <>
                <Line dataKey="p5"  name="5th %ile"  stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
                <Line dataKey="p50" name="50th %ile" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
                <Line dataKey="p95" name="95th %ile" stroke="#86efac" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="line" isAnimationActive={false} connectNulls />
              </>
            )}

            <Line dataKey="y" name={title} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls legendType="line" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function GrowthTab({ records, birthdate, sex, onAdd, onDelete, onError }) {
  const { themeConfig } = useTheme();
  const [chartColor0, chartColor1, chartColor2] = themeConfig.chartColors;
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

  const hasBirthdate = !!birthdate;
  const sorted = [...records].sort((a, b) => a.recordedDate < b.recordedDate ? -1 : 1);

  let weightBaby = [], heightBaby = [], headBaby = [];
  if (hasBirthdate) {
    sorted.forEach(r => {
      const mo = ageInMonths(birthdate, r.recordedDate);
      if (mo < 0) return;
      if (r.weightLbs != null) weightBaby.push({ x: mo, y: parseFloat(r.weightLbs) });
      if (r.heightIn  != null) heightBaby.push({ x: mo, y: parseFloat(r.heightIn) });
      if (r.headIn    != null) headBaby.push({ x: mo, y: parseFloat(r.headIn) });
    });
  } else {
    sorted.forEach(r => {
      if (r.weightLbs != null) weightBaby.push({ x: r.recordedDate, y: parseFloat(r.weightLbs) });
      if (r.heightIn  != null) heightBaby.push({ x: r.recordedDate, y: parseFloat(r.heightIn) });
      if (r.headIn    != null) headBaby.push({ x: r.recordedDate, y: parseFloat(r.headIn) });
    });
  }

  let weightPerc = null, heightPerc = null, headPerc = null;
  if (hasBirthdate) {
    const currentAgeMonths = ageInMonths(birthdate, today);
    if (currentAgeMonths <= 36) {
      weightPerc = getPercentileData('weight', sex).map(p => ({ ...p, x: p.month }));
      heightPerc = getPercentileData('length', sex).map(p => ({ ...p, x: p.month }));
      headPerc   = getPercentileData('head',   sex).map(p => ({ ...p, x: p.month }));
    }
  }

  const showCharts = records.length >= 1;
  const xLabel = hasBirthdate ? 'Age (months)' : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-color-success" /> Log Measurement
          </h2>

          <div>
            <Label>Date</Label>
            <Input type="date" value={recordedDate} onChange={e => setRecordedDate(e.target.value)} className="" />
          </div>
          <div>
            <Label>Weight (lbs)</Label>
            <Input type="number" step="0.01" min="0" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="e.g. 12.5" className="" />
          </div>
          <div>
            <Label>Height</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input type="number" step="1" min="0" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="ft" className="" />
              </div>
              <div className="flex-1">
                <Input type="number" step="0.1" min="0" max="11.9" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="in" className="" />
              </div>
            </div>
          </div>
          <div>
            <Label>Head circumference (in)</Label>
            <Input type="number" step="0.1" min="0" value={headIn} onChange={e => setHeadIn(e.target.value)} placeholder="e.g. 15.5" className="" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Doctor's comment…" className="" />
          </div>

          <LoadingButton onClick={handleAdd} loading={saving} loadingText="Saving..." className="w-full">
            Save Measurement
          </LoadingButton>

          {!hasBirthdate && (
            <p className="text-xs text-muted-foreground text-center">Set a birthdate in Dashboard to see WHO percentile curves</p>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {showCharts && (
          <>
            <MetricChart title="Weight (lbs)" color={chartColor0} babyData={weightBaby} percData={weightPerc} yLabel="lbs" xLabel={xLabel} />
            <MetricChart title="Height (in)" color={chartColor1} babyData={heightBaby} percData={heightPerc} yLabel="in" xLabel={xLabel} />
            <MetricChart title="Head circumference (in)" color={chartColor2} babyData={headBaby} percData={headPerc} yLabel="in" xLabel={xLabel} />
          </>
        )}

        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <h3 className="font-display font-bold text-foreground mb-4">Records</h3>
            {!records.length ? (
              <EmptyState label="No measurements yet. Log your first one!" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
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
                        <td className="py-2 pr-3 text-foreground">{r.recordedDate}</td>
                        <td className="py-2 pr-3">{r.weightLbs != null ? `${r.weightLbs} lbs` : '—'}</td>
                        <td className="py-2 pr-3">{inchesToDisplay(r.heightIn)}</td>
                        <td className="py-2 pr-3">{r.headIn != null ? `${r.headIn}"` : '—'}</td>
                        <td className="py-2 pr-3 text-muted-foreground max-w-[140px] truncate">{r.notes || ''}</td>
                        <td className="py-2 text-right">
                          {confirmDeleteId === r.id ? (
                            <span className="flex items-center gap-1 justify-end">
                              <span className="text-xs text-muted-foreground">Delete?</span>
                              <button onClick={() => { onDelete(r.id); setConfirmDeleteId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700 px-1">Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(r.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors" title="Delete">
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
