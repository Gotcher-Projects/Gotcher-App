import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { CalendarDays, Baby, Camera } from "lucide-react";
import { weeksPregnant, daysUntilDue, trimester } from "../../lib/pregnancy";
import { sizeForWeek, formatLength, formatWeight } from "../../lib/pregnancySizes";
import { twemojiSrc } from "../../lib/twemoji";
import AppointmentTab from "../tabs/AppointmentTab";
import BumpDiary from "./BumpDiary";

const TRIMESTER_LABEL = { 1: "1st", 2: "2nd", 3: "3rd" };

// Renders the bundled Twemoji SVG for consistency across devices; falls back to the OS emoji
// glyph if the asset is ever missing.
function SizeIcon({ emoji, label }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="text-7xl mb-4" role="img" aria-label={label}>{emoji}</div>;
  }
  return (
    <img
      src={twemojiSrc(emoji)}
      alt={label}
      className="mx-auto mb-4 h-28 w-28"
      onError={() => setFailed(true)}
    />
  );
}

function MarkBornDialog({ open, onOpenChange, currentSex, babyName, onMarkBorn, onError }) {
  const [birthdate, setBirthdate] = useState("");
  const [sex, setSex] = useState("");
  const [saving, setSaving] = useState(false);
  const askSex = currentSex === "unknown"; // S1 carried 'not sure yet' over — capture it now

  async function handleConfirm() {
    setSaving(true);
    try {
      // Only send sex when we asked for it (sex was unknown). '' = prefer not to say → clears unknown.
      await onMarkBorn(birthdate, askSex ? sex : undefined);
      onOpenChange(false);
    } catch {
      onError("Failed to mark as born");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" />
            {babyName ? `${babyName} has arrived?` : "Your baby has arrived?"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            This switches CradleHQ into baby mode. Your bump diary and pregnancy entries stay
            accessible and editable afterward.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="mb-date">Birth date <span className="text-red-500">*</span></Label>
            <Input
              id="mb-date"
              type="date"
              value={birthdate}
              onChange={e => setBirthdate(e.target.value)}
              className="bg-white"
            />
          </div>
          {askSex && (
            <div className="space-y-1.5">
              <Label htmlFor="mb-sex">
                Is it a boy or a girl? <span className="text-muted-foreground font-normal">(you can change this later)</span>
              </Label>
              <select
                id="mb-sex"
                value={sex}
                onChange={e => setSex(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Prefer not to say</option>
                <option value="boy">Boy</option>
                <option value="girl">Girl</option>
              </select>
            </div>
          )}
          <LoadingButton
            loading={saving}
            onClick={handleConfirm}
            disabled={!birthdate}
            className="w-full"
          >
            Confirm — switch to baby mode 👶
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PregnancyHome({
  profile,
  appointments,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  bumpPhotos,
  onAddBump,
  onUpdateBump,
  onDeleteBump,
  onBumpUpload,
  onMarkBorn,
  onError,
}) {
  const [markBornOpen, setMarkBornOpen] = useState(false);

  const dueDate = profile?.dueDate;
  const week = weeksPregnant(dueDate);
  const daysLeft = daysUntilDue(dueDate);
  const tri = trimester(week);
  const size = sizeForWeek(week);
  const length = formatLength(size.lengthCm);
  const weight = formatWeight(size.weightG);
  const progressPct = Math.min(100, Math.round((week / 40) * 100));
  // Before ~week 7 the figures are vanishingly small ("0.0 in"); let the blurb carry the card.
  const showMeasurements = size.week >= 7;
  // The length nearly doubles at week 21 because measurement switches to head-to-toe — explain it.
  const showHeadToToeNote = size.week === 20 || size.week === 21;

  const dueDisplay = dueDate
    ? new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const countdownLine =
    daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go`
    : daysLeft === 0 ? "Due today!"
    : `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} past your due date`;

  return (
    <div className="space-y-6">
      {/* 1. Countdown header */}
      <Card className="shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-display font-bold text-2xl text-brand-navy">Week {week}</h2>
              <p className="text-sm text-muted-foreground">{TRIMESTER_LABEL[tri]} trimester · {countdownLine}</p>
            </div>
            {dueDisplay && (
              <p className="text-sm text-muted-foreground">Due <span className="font-medium text-foreground">{dueDisplay}</span></p>
            )}
          </div>
          <div className="mt-4 h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Week 0</span>
            <span>Week 40</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Size card (hero) */}
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <SizeIcon emoji={size.emoji} label={size.label} />
          <p className="text-lg text-foreground">
            Your baby is about the size of <span className="font-display font-bold text-primary">{size.label}</span>
          </p>
          {showMeasurements && (
            <div className="mt-4 flex justify-center gap-8 text-sm">
              <div>
                <div className="font-semibold text-foreground">{length.imperial}</div>
                <div className="text-xs text-muted-foreground">{length.metric}</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{weight.imperial}</div>
                <div className="text-xs text-muted-foreground">{weight.metric}</div>
              </div>
            </div>
          )}
          {showHeadToToeNote && (
            <p className="mt-3 text-xs text-muted-foreground max-w-md mx-auto">
              📏 From around now we measure head-to-toe instead of head-to-bottom, so the length takes a jump.
            </p>
          )}
          <p className="mt-5 text-sm text-muted-foreground max-w-md mx-auto">{size.blurb}</p>
        </CardContent>
      </Card>

      {/* 3. This week */}
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-foreground mb-2">This week</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{size.detail}</p>
        </CardContent>
      </Card>

      {/* 4. Prenatal appointments — reuses the baby-mode appointments feature */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-color-success" />
          Prenatal appointments
        </h3>
        <AppointmentTab
          appointments={appointments}
          onAdd={onAddAppointment}
          onUpdate={onUpdateAppointment}
          onDelete={onDeleteAppointment}
          onError={onError}
        />
      </div>

      {/* 5. Bump diary */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-color-highlight" />
          Bump diary
        </h3>
        <BumpDiary
          photos={bumpPhotos}
          currentWeek={week}
          onAdd={onAddBump}
          onUpdate={onUpdateBump}
          onDelete={onDeleteBump}
          onUpload={onBumpUpload}
          onError={onError}
        />
      </div>

      {/* 6. Mark as born */}
      <Card className="shadow-xl rounded-2xl border-primary/30">
        <CardContent className="p-6 text-center">
          <h3 className="font-display font-semibold text-foreground mb-1">Baby's here?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add their birthday to switch CradleHQ into baby mode.
          </p>
          <Button onClick={() => setMarkBornOpen(true)}>Add their birthday 👶</Button>
        </CardContent>
      </Card>

      <MarkBornDialog
        open={markBornOpen}
        onOpenChange={setMarkBornOpen}
        currentSex={profile?.sex}
        babyName={profile?.name}
        onMarkBorn={onMarkBorn}
        onError={onError}
      />

      <p className="text-center text-[11px] text-muted-foreground/70">
        Size icons by <a href="https://github.com/jdecked/twemoji" className="hover:underline" target="_blank" rel="noreferrer">Twemoji</a>, licensed CC-BY 4.0
      </p>
    </div>
  );
}
