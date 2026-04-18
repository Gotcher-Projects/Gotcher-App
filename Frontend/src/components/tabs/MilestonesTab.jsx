import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { MILESTONES } from "@/lib/babyData";

export default function MilestonesTab({ data, week, onToggle }) {
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
