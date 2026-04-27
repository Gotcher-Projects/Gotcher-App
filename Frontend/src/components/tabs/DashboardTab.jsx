import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, CalendarDays, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import { MILESTONES } from "@/lib/babyData";
import { formatBabyAge } from "@/lib/babyAge";
import { fmtDuration, timeAgo, computeFeedingStats, computeSleepStats } from "@/lib/dashboardStats";

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  onManualAdd, onAddSleep, onAddDiaper,
  setActiveTab, setHealthView,
  onError,
}) {
  const [quickLogOpen, setQuickLogOpen] = useState(null);
  const [quickLogForm, setQuickLogForm] = useState({});
  const [quickLogSaving, setQuickLogSaving] = useState(false);
  const [quickLogSaved, setQuickLogSaved] = useState(false);

  function openQuickLog(id) {
    setQuickLogOpen(id);
    setQuickLogSaved(false);
    const date = nowDate();
    const time = nowTime();
    if (id === 'bottle') setQuickLogForm({ date, time, oz: '', feedType: 'bottle' });
    else if (id === 'nurse')  setQuickLogForm({ date, time, duration: '15', side: 'breast_left' });
    else if (id === 'diaper') setQuickLogForm({ date, time, category: 'poop', type: 'normal', color: '', consistency: '', showDetails: false });
    else if (id === 'sleep')  setQuickLogForm({ date, startTime: '', endTime: time, sleepType: 'nap' });
  }

  function closeQuickLog() {
    setQuickLogOpen(null);
    setQuickLogForm({});
    setQuickLogSaved(false);
  }

  async function submitQuickLog() {
    setQuickLogSaving(true);
    try {
      const d = quickLogForm.date || nowDate();
      if (quickLogOpen === 'bottle') {
        const startedAt = new Date(`${d}T${quickLogForm.time}`).toISOString();
        await onManualAdd({ type: quickLogForm.feedType || 'bottle', startedAt, endedAt: startedAt, oz: parseFloat(quickLogForm.oz) || null });
      } else if (quickLogOpen === 'nurse') {
        const endDt = new Date(`${d}T${quickLogForm.time}`);
        const startDt = new Date(endDt.getTime() - (parseInt(quickLogForm.duration, 10) || 0) * 60000);
        await onManualAdd({ type: quickLogForm.side || 'breast_left', startedAt: startDt.toISOString(), endedAt: endDt.toISOString() });
      } else if (quickLogOpen === 'diaper') {
        const loggedAt = new Date(`${d}T${quickLogForm.time}`).toISOString();
        const diaperPayload = { loggedAt, category: quickLogForm.category || 'poop' };
        if (diaperPayload.category === 'poop') {
          diaperPayload.type = quickLogForm.type || 'normal';
          if (quickLogForm.color) diaperPayload.color = quickLogForm.color;
          if (quickLogForm.consistency) diaperPayload.consistency = quickLogForm.consistency;
        }
        await onAddDiaper(diaperPayload);
      } else if (quickLogOpen === 'sleep') {
        const startedAt = new Date(`${d}T${quickLogForm.startTime}`);
        let endedAt     = new Date(`${d}T${quickLogForm.endTime}`);
        if (endedAt <= startedAt) endedAt.setDate(endedAt.getDate() + 1);
        await onAddSleep({ type: quickLogForm.sleepType || 'nap', startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() });
      }
      setQuickLogSaved(true);
      setTimeout(closeQuickLog, 1500);
    } catch (err) {
      onError?.(err.message || 'Failed to log entry');
    }
    setQuickLogSaving(false);
  }

  function canSubmit() {
    if (quickLogOpen === 'bottle') return !!quickLogForm.time;
    if (quickLogOpen === 'nurse')  return !!quickLogForm.time && !!quickLogForm.duration;
    if (quickLogOpen === 'diaper') return !!quickLogForm.time;
    if (quickLogOpen === 'sleep')  return !!quickLogForm.startTime && !!quickLogForm.endTime;
    return false;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const { mostRecentFeed, todayFeeds, avgGapStr } = computeFeedingStats(feeding);
  const { completedSleep, totalSleepSecs, longestSleepSecs, mostRecentSleep } = computeSleepStats(sleep);

  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="p-6">
        {/* ── Header ── */}
        <h2 className="text-2xl font-bold font-display text-foreground mb-5 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          {(() => {
            const ageText = formatBabyAge(data.profile.birthdate);
            const name = data.profile.name || 'Baby';
            return ageText ? `${name} is ${ageText}` : `${name}'s dashboard`;
          })()}
        </h2>

        {/* ── Quick Log ── */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" /> Quick Log
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_LOG_BUTTONS.map(btn => (
              <button
                key={btn.id}
                onClick={() => quickLogOpen === btn.id ? closeQuickLog() : openQuickLog(btn.id)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  quickLogOpen === btn.id
                    ? 'border-primary/50 bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground hover:border-border/80 hover:bg-muted'
                }`}
              >
                <span className="text-xl leading-none">{btn.icon}</span>
                <span className="text-xs">{btn.label}</span>
              </button>
            ))}
          </div>

          {quickLogOpen && !quickLogSaved && (
            <div className="mt-3 p-4 bg-muted/50 rounded-xl border border-border space-y-3">
              {quickLogOpen === 'bottle' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {[{ value: 'bottle', label: '🍼 Bottle' }, { value: 'formula', label: '🥛 Formula' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQuickLogForm(f => ({ ...f, feedType: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${quickLogForm.feedType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
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
                        value={quickLogForm.oz}
                        onChange={e => setQuickLogForm(f => ({ ...f, oz: e.target.value }))}
                        placeholder="e.g. 4"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input type="time" value={quickLogForm.time} onChange={e => setQuickLogForm(f => ({ ...f, time: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={quickLogForm.date} onChange={e => setQuickLogForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {quickLogOpen === 'nurse' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {[{ value: 'breast_left', label: '⬅ Left' }, { value: 'breast_right', label: 'Right ➡' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQuickLogForm(f => ({ ...f, side: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${quickLogForm.side === opt.value ? 'bg-color-highlight text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
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
                        value={quickLogForm.duration}
                        onChange={e => setQuickLogForm(f => ({ ...f, duration: e.target.value }))}
                        placeholder="15"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End time</Label>
                      <Input type="time" value={quickLogForm.time} onChange={e => setQuickLogForm(f => ({ ...f, time: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={quickLogForm.date} onChange={e => setQuickLogForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {quickLogOpen === 'diaper' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {[{ value: 'poop', label: '💩 Poop' }, { value: 'pee', label: '💧 Pee' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQuickLogForm(f => ({ ...f, category: opt.value, showDetails: false }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${quickLogForm.category === opt.value ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {quickLogForm.category === 'poop' && (
                      <div>
                        <Label className="text-xs">Type</Label>
                        <select
                          value={quickLogForm.type}
                          onChange={e => setQuickLogForm(f => ({ ...f, type: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="normal">Normal</option>
                          <option value="loose">Loose</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input type="time" value={quickLogForm.time} onChange={e => setQuickLogForm(f => ({ ...f, time: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={quickLogForm.date} onChange={e => setQuickLogForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  {quickLogForm.category === 'poop' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setQuickLogForm(f => ({ ...f, showDetails: !f.showDetails }))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {quickLogForm.showDetails ? '▲ Hide details' : '▼ More details (color & consistency)'}
                      </button>
                      {quickLogForm.showDetails && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Color <span className="text-muted-foreground">(optional)</span></Label>
                            <select
                              value={quickLogForm.color}
                              onChange={e => setQuickLogForm(f => ({ ...f, color: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">— select —</option>
                              <option value="yellow">Yellow</option>
                              <option value="brown">Brown</option>
                              <option value="green">Green</option>
                              <option value="black">Black</option>
                              <option value="red">Red</option>
                              <option value="white">White</option>
                              <option value="orange">Orange</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">Consistency <span className="text-muted-foreground">(optional)</span></Label>
                            <select
                              value={quickLogForm.consistency}
                              onChange={e => setQuickLogForm(f => ({ ...f, consistency: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">— select —</option>
                              <option value="normal">Normal</option>
                              <option value="watery">Watery</option>
                              <option value="seedy">Seedy</option>
                              <option value="mucusy">Mucusy</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {quickLogOpen === 'sleep' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {[{ value: 'nap', label: '☀️ Nap' }, { value: 'night', label: '🌙 Night' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQuickLogForm(f => ({ ...f, sleepType: opt.value }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${quickLogForm.sleepType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Sleep time</Label>
                    <Input type="time" value={quickLogForm.startTime} onChange={e => setQuickLogForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Wake time</Label>
                    <Input type="time" value={quickLogForm.endTime} onChange={e => setQuickLogForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={quickLogForm.date} onChange={e => setQuickLogForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={submitQuickLog}
                  disabled={quickLogSaving || !canSubmit()}
                  className="h-8 text-sm px-4"
                >
                  {quickLogSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Log it'}
                </Button>
                <Button variant="ghost" onClick={closeQuickLog} className="h-8 text-sm px-4">Cancel</Button>
              </div>
            </div>
          )}

          {quickLogSaved && (
            <div className="mt-3 p-3 bg-color-success/10 border border-color-success/30 rounded-xl text-sm text-color-success font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Logged!
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-color-warm/30 rounded-xl border space-y-1.5">
            <div className="text-xs font-semibold text-color-highlight uppercase tracking-wide mb-1">🍼 Feeding</div>
            {mostRecentFeed ? (
              <>
                <div className="text-xs text-muted-foreground">Last feed: <span className="font-medium text-foreground">{timeAgo(mostRecentFeed.endedAt)}</span></div>
                <div className="text-xs text-muted-foreground">Today: <span className="font-medium text-foreground">{todayFeeds.length} feed{todayFeeds.length !== 1 ? 's' : ''}</span></div>
                {avgGapStr && <div className="text-xs text-muted-foreground">Avg gap: <span className="font-medium text-foreground">{avgGapStr}</span></div>}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No feeds logged yet</div>
            )}
          </div>
          <div className="p-3 bg-brand-lavender/60 rounded-xl border space-y-1.5">
            <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">😴 Sleep</div>
            {completedSleep.length > 0 ? (
              <>
                <div className="text-xs text-muted-foreground">Last 24h: <span className="font-medium text-foreground">{fmtDuration(totalSleepSecs)}</span></div>
                {longestSleepSecs > 0 && <div className="text-xs text-muted-foreground">Longest: <span className="font-medium text-foreground">{fmtDuration(longestSleepSecs)}</span></div>}
                {mostRecentSleep && <div className="text-xs text-muted-foreground">Last wake: <span className="font-medium text-foreground">{timeAgo(mostRecentSleep.endedAt)}</span></div>}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No sleep logged in 24h</div>
            )}
          </div>
        </div>

        {/* ── Profile + Milestones grid ── */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold font-display text-lg">Profile Setup</h3>
            <div>
              <Label>Baby's Name</Label>
              <Input
                value={data.profile.name}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, name: e.target.value } }))}
                placeholder="e.g., Harper"
                className=""
              />
            </div>
            <div>
              <Label>Birthdate</Label>
              <Input
                type="date"
                value={data.profile.birthdate}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, birthdate: e.target.value } }))}
                className=""
              />
            </div>
            <div>
              <Label>Sex</Label>
              <select
                value={data.profile.sex || ''}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, sex: e.target.value } }))}
                className="mt-1 w-full rounded-md border border-border bg-input text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                className=""
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={data.profile.email}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, email: e.target.value } }))}
                placeholder="your@email.com"
                className=""
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={data.profile.phone}
                onChange={(e) => setData(d => ({ ...d, profile: { ...d.profile, phone: e.target.value } }))}
                placeholder="555-0123"
                className=""
              />
            </div>
            <Button
              onClick={onSaveProfile}
              disabled={profileSaving}
              className="w-full"
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
            <h3 className="font-semibold font-display text-lg mb-3">Milestones</h3>

            {!data.profile.birthdate ? (
              <p className="text-muted-foreground p-4 bg-card rounded-lg border text-center text-sm">
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
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Overall progress</span>
                      <span>{achieved} / {total}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-brand-purple to-color-success h-3 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pct}% complete</p>
                  </div>

                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Week {gk}–{gk + 4}</h4>

                  {allCurrentDone ? (
                    <div className="p-3 bg-color-success/10 border border-color-success/30 rounded-xl text-sm text-color-success font-medium flex items-center gap-2 mb-2">
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
                            checked ? 'bg-color-warm/40 border-color-warm' : 'bg-card border-border'
                          }`}>
                            <Checkbox
                              id={`dash-${key}`}
                              checked={checked}
                              onCheckedChange={val => onToggleMilestone(key, !!val)}
                              className="border-color-highlight/50 data-[state=checked]:bg-color-highlight data-[state=checked]:border-color-highlight"
                            />
                            <Label htmlFor={`dash-${key}`} className="cursor-pointer text-sm flex-1 text-foreground">
                              {m}
                            </Label>
                            {checked && <CheckCircle2 className="w-4 h-4 text-color-success flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {setActiveTab && (
                    <button
                      onClick={() => { setActiveTab('health'); setHealthView?.('milestones'); }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      See all milestones <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </>
              );
            })()}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="p-3 bg-brand-lavender/50 rounded-lg border text-center">
                <div className="text-2xl font-bold text-primary">
                  {Object.values(data.milestones).filter(Boolean).length}
                </div>
                <div className="text-xs text-muted-foreground">Milestones</div>
              </div>
              <div className="p-3 bg-color-highlight/10 rounded-lg border text-center">
                <div className="text-2xl font-bold text-color-highlight">{data.journal.length}</div>
                <div className="text-xs text-muted-foreground">Memories</div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-color-success/10 border border-color-success/30 rounded-xl">
              <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-color-success" />
                Upcoming Appointments
              </h4>
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const upcoming = (appointments || [])
                  .filter(a => a.appointmentDate >= today && !a.isCompleted)
                  .slice(0, 3);
                if (upcoming.length === 0) {
                  return <p className="text-xs text-muted-foreground">No upcoming appointments</p>;
                }
                return (
                  <div className="space-y-1.5">
                    {upcoming.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm text-foreground">
                        <span className="font-medium text-color-success min-w-[52px]">
                          {new Date(a.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {a.appointmentTime && ` · ${new Date(`1970-01-01T${a.appointmentTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        </span>
                        <span className="truncate">{a.appointmentType || '—'}</span>
                        {a.doctorName && <span className="text-muted-foreground truncate">· {a.doctorName}</span>}
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
