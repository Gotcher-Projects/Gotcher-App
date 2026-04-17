import React, { useState, useEffect } from "react";
import PillNav from "@/components/ui/PillNav";
import GrowthTab from "./GrowthTab";
import VaccineTab from "./VaccineTab";
import AppointmentTab from "./AppointmentTab";
import MilestonesTab from "./MilestonesTab";

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
