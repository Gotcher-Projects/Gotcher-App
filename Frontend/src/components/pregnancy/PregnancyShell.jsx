import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Camera } from "lucide-react";
import { weeksPregnant } from "../../lib/pregnancy";
import PregnancyHome from "./PregnancyHome";
import AppointmentTab from "../tabs/AppointmentTab";
import BumpDiary from "./BumpDiary";

// Tabbed shell for pregnancy mode (Home · Appointments · Bump), mirroring baby mode's <Tabs>.
// PregnancyHome holds the Home-tab content; appointments and the bump diary get their own tabs.
export default function PregnancyShell({
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
  const [tab, setTab] = useState("home");

  const dueDate = profile?.dueDate;
  const currentWeek = dueDate ? weeksPregnant(dueDate) : null;
  // Date→Week reference: due date in pregnancy mode (always set here).
  const weekRefDate = dueDate || profile?.birthdate || null;

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full h-auto flex-wrap justify-start gap-1.5 bg-card/80 p-2">
        <TabsTrigger value="home" className="flex-1 min-w-[80px] text-xs sm:text-sm font-medium">Home</TabsTrigger>
        <TabsTrigger value="appointments" className="flex-1 min-w-[80px] text-xs sm:text-sm font-medium">Appointments</TabsTrigger>
        <TabsTrigger value="bump" className="flex-1 min-w-[80px] text-xs sm:text-sm font-medium">Diary</TabsTrigger>
      </TabsList>

      <TabsContent value="home" className="mt-4">
        <PregnancyHome profile={profile} onMarkBorn={onMarkBorn} onError={onError} />
      </TabsContent>

      <TabsContent value="appointments" className="mt-4">
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
      </TabsContent>

      <TabsContent value="bump" className="mt-4">
        <div>
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-color-highlight" />
            Bump diary
          </h3>
          <BumpDiary
            photos={bumpPhotos}
            currentWeek={currentWeek}
            weekRefDate={weekRefDate}
            onAdd={onAddBump}
            onUpdate={onUpdateBump}
            onDelete={onDeleteBump}
            onUpload={onBumpUpload}
            onError={onError}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
