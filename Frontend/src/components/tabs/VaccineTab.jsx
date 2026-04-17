import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { VACCINES } from "@/lib/babyData";

const VACCINE_AGE_LABELS = {
  birth: "Birth",
  "2m":  "2 Months",
  "4m":  "4 Months",
  "6m":  "6 Months",
  "12m": "12 Months",
  "15m": "15 Months",
  "18m": "18 Months",
};

export default function VaccineTab({ vaccines, onToggle }) {
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
