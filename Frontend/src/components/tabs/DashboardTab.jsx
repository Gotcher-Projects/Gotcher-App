import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, CalendarDays, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import { MILESTONES } from "@/lib/babyData";
import { formatBabyAge } from "@/lib/babyAge";

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDuration(secs) {
  if (!secs || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

const QUICK_LOG_BUTTONS = [
  { id: 'bottle', label: 'Bottle', icon: '🍼' },
  { id: 'nurse',  label: 'Nurse',  icon: '🤱' },
  { id: 'diaper', label: 'Diaper', icon: '💧' },
  { id: 'sleep',  label: 'Sleep',  icon: '😴' },
];

export default function DashboardTab({
  data, setData, week, months,
  onSaveProfile, profileSaving, profileSaved,
  onToggleMilestone, appointments,
  feeding, sleep,
  onManualAdd, onAddSleep, onAddPoop,
  setActiveTab, setHealthView,
  onError,
}) {
  const [qlOpen, setQlOpen] = useState(null);
  const [qlForm, setQlForm] = useState({});
  const [qlSaving, setQlSaving] = useState(false);
  const [qlSaved, setQlSaved] = useState(false);

  function openQuickLog(id) {
    setQlOpen(id);
    setQlSaved(false);
    const date = nowDate();
    const time = nowTime();
    if (id === 'bottle') setQlForm({ date, time, oz: '', feedType: 'bottle' });
    else if (id === 'nurse')  setQlForm({ date, time, duration: '15', side: 'breast_left' });
    else if (id === 'diaper') setQlForm({ date, time, type: 'normal' });
    else if (id === 'sleep')  setQlForm({ date, startTime: '', endTime: time, sleepType: 'nap' });
  }

  function closeQuickLog() {
    setQlOpen(null);
    setQlForm({});
    setQlSaved(false);
  }

  async function submitQuickLog() {
    setQlSaving(true);
    try {
      const d = qlForm.date || nowDate();
      if (qlOpen === 'bottle') {
        const startedAt = new Date(`${d}T${qlForm.time}`).toISOString();
        await onManualAdd({ type: qlForm.feedType || 'bottle', startedAt, endedAt: startedAt, oz: parseFloat(qlForm.oz) || null });
      } else if (qlOpen === 'nurse') {
        const endDt = new Date(`${d}T${qlForm.time}`);
        const startDt = new Date(endDt.getTime() - (parseInt(qlForm.duration, 10) || 0) * 60000);
        await onManualAdd({ type: qlForm.side || 'breast_left', startedAt: startDt.toISOString(), endedAt: endDt.toISOString() });
      } else if (qlOpen === 'diaper') {
        const loggedAt = new Date(`${d}T${qlForm.time}`).toISOString();
        await onAddPoop({ loggedAt, type: qlForm.type || 'normal' });
      } else if (qlOpen === 'sleep') {
        const startedAt = new Date(`${d}T${qlForm.startTime}`).toISOString();
        const endedAt   = new Date(`${d}T${qlForm.endTime}`).toISOString();
        await onAddSleep({ type: qlForm.sleepType || 'nap', startedAt, endedAt });
      }
      setQlSaved(true);
      setTimeout(closeQuickLog, 1500);
    } catch (err) {
      onError?.(err.message || 'Failed to log entry');
    }
    setQlSaving(false);
  }

  function canSubmit() {
    if (qlOpen === 'bottle') return !!qlForm.time;
    if (qlOpen === 'nurse')  return !!qlForm.time && !!qlForm.duration;
    if (qlOpen === 'diaper') return !!qlForm.time;
    if (qlOpen === 'sleep')  return !!qlForm.startTime && !!qlForm.endTime;
    return false;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const cutoff24h = Date.now() - 24 * 3600 * 1000;

  const completedFeeds = (feeding || []).filter(l => l.endedAt);
  const todayFeeds = completedFeeds.filter(l => new Date(l.startedAt) >= midnight);
  const mostRecentFeed = [...completedFeeds].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0];
  let avgGapStr = null;
  if (todayFeeds.length >= 2) {
    const sorted = [...todayFeeds].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGap += (new Date(sorted[i].startedAt) - new Date(sorted[i - 1].startedAt)) / 60000;
    }
    const avgMins = Math.round(totalGap / (sorted.length - 1));
    avgGapStr = avgMins < 60 ? `${avgMins}m` : `${Math.floor(avgMins / 60)}h ${avgMins % 60 || 0}m`;
  }

  const completedSleep = (sleep || []).filter(l => l.endedAt && new Date(l.startedAt) >= new Date(cutoff24h));
  const totalSleepSecs = completedSleep.reduce(
    (s, l) => s + (new Date(l.endedAt) - new Date(l.startedAt)) / 1000, 0
  );
  const longestSleepSecs = completedSleep.reduce((max, l) => {
    const d = (new Date(l.endedAt) - new Date(l.startedAt)) / 1000;
    return d > max ? d : max;
  }, 0);
  const mostRecentSleep = [...completedSleep].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0];

  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="p-6">
        {/* ── Header ── */}
        <h2 className="text-2xl font-bold text-slate-800 mb-5 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          {(() => {
            const ageText = formatBabyAge(data.profile.birthdate);
            const name = data.profile.name || 'Baby';
            return ageText ? `${name} is ${ageText}` : `${name}'s dashboard`;
          })()}
        </h2>

        {/* ── Quick Log ── */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-fuchsia-500" /> Quick Log
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_LOG_BUTTONS.map(btn => (
              <button
                key={btn.id}
                onClick={() => qlOpen === btn.id ? closeQuickLog() : openQuickLog(btn.id)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  qlOpen === btn.id
                    ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl leading-none">{btn.icon}</span>
                <span className="text-xs">{btn.label}</span>
              </button>
            ))}
          </div>

          {qlOpen && !qlSaved && (
            <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              {qlOpen === 'bottle' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    {[{ value: 'bottle', label: '🍼 Bottle' }, { value: 'formula', label: '🥛 Formula' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQlForm(f => ({ ...f, feedType: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${qlForm.feedType === opt.value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">oz (optional)</Label>
                      <Input
                        type="number" min="0" step="0.5"
                        value={qlForm.oz}
                        onChange={e => setQlForm(f => ({ ...f, oz: e.target.value }))}
                        placeholder="e.g. 4"
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input type="time" value={qlForm.time} onChange={e => setQlForm(f => ({ ...f, time: e.target.value }))} className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={qlForm.date} onChange={e => setQlForm(f => ({ ...f, date: e.target.value }))} className="mt-1 bg-white" />
                    </div>
                  </div>
                </div>
              )}

              {qlOpen === 'nurse' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    {[{ value: 'breast_left', label: '⬅ Left' }, { value: 'breast_right', label: 'Right ➡' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQlForm(f => ({ ...f, side: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${qlForm.side === opt.value ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Duration (min)</Label>
                      <Input
                        type="number" min="1"
                        value={qlForm.duration}
                        onChange={e => setQlForm(f => ({ ...f, duration: e.target.value }))}
                        placeholder="15"
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End time</Label>
                      <Input type="time" value={qlForm.time} onChange={e => setQlForm(f => ({ ...f, time: e.target.value }))} className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={qlForm.date} onChange={e => setQlForm(f => ({ ...f, date: e.target.value }))} className="mt-1 bg-white" />
                    </div>
                  </div>
                </div>
              )}

              {qlOpen === 'diaper' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <select
                      value={qlForm.type}
                      onChange={e => setQlForm(f => ({ ...f, type: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="normal">Normal</option>
                      <option value="loose">Loose</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Input type="time" value={qlForm.time} onChange={e => setQlForm(f => ({ ...f, time: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={qlForm.date} onChange={e => setQlForm(f => ({ ...f, date: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                </div>
              )}

              {qlOpen === 'sleep' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    {[{ value: 'nap', label: '☀️ Nap' }, { value: 'night', label: '🌙 Night' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQlForm(f => ({ ...f, sleepType: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${qlForm.sleepType === opt.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Sleep time</Label>
                    <Input type="time" value={qlForm.startTime} onChange={e => setQlForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Wake time</Label>
                    <Input type="time" value={qlForm.endTime} onChange={e => setQlForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={qlForm.date} onChange={e => setQlForm(f => ({ ...f, date: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={submitQuickLog}
                  disabled={qlSaving || !canSubmit()}
                  className="bg-fuchsia-600 hover:bg-fuchsia-700 h-8 text-sm px-4"
                >
                  {qlSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Log it'}
                </Button>
                <Button variant="ghost" onClick={closeQuickLog} className="h-8 text-sm px-4">Cancel</Button>
              </div>
            </div>
          )}

          {qlSaved && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Logged!
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-white rounded-xl border space-y-1.5">
            <div className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">🍼 Feeding</div>
            {mostRecentFeed ? (
              <>
                <div className="text-xs text-slate-600">Last feed: <span className="font-medium text-slate-800">{timeAgo(mostRecentFeed.endedAt)}</span></div>
                <div className="text-xs text-slate-600">Today: <span className="font-medium text-slate-800">{todayFeeds.length} feed{todayFeeds.length !== 1 ? 's' : ''}</span></div>
                {avgGapStr && <div className="text-xs text-slate-600">Avg gap: <span className="font-medium text-slate-800">{avgGapStr}</span></div>}
              </>
            ) : (
              <div className="text-xs text-slate-400">No feeds logged yet</div>
            )}
          </div>
          <div className="p-3 bg-white rounded-xl border space-y-1.5">
            <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">😴 Sleep</div>
            {completedSleep.length > 0 ? (
              <>
                <div className="text-xs text-slate-600">Last 24h: <span className="font-medium text-slate-800">{fmtDuration(totalSleepSecs)}</span></div>
                {longestSleepSecs > 0 && <div className="text-xs text-slate-600">Longest: <span className="font-medium text-slate-800">{fmtDuration(longestSleepSecs)}</span></div>}
                {mostRecentSleep && <div className="text-xs text-slate-600">Last wake: <span className="font-medium text-slate-800">{timeAgo(mostRecentSleep.endedAt)}</span></div>}
              </>
            ) : (
              <div className="text-xs text-slate-400">No sleep logged in 24h</div>
            )}
          </div>
        </div>

        {/* ── Profile + Milestones grid ── */}
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
              <Label>Sex</Label>
              <select
                value={data.profile.sex || ''}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, sex: e.target.value } }))}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
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
              const allCurrentDone = currentItems.length > 0 &&
                currentItems.every((_, i) => data.milestones[`${gk}-${i}`]);

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

                  {allCurrentDone ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      All milestones for this age group achieved!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto mb-2">
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
                  )}

                  {setActiveTab && (
                    <button
                      onClick={() => { setActiveTab('health'); setHealthView?.('milestones'); }}
                      className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-800 font-medium transition-colors"
                    >
                      See all milestones <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
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
