import React, { useState } from "react";
import PillNav from "@/components/ui/PillNav";
import FeedingTab from "./FeedingTab";
import SleepTab from "./SleepTab";
import DiaperTab from "./DiaperTab";

export default function TrackTab({ feeding, sleep, diaper, onStart, onStop, onDeleteFeed, onManualAdd, onAddSleep, onDeleteSleep, onAddDiaper, onDeleteDiaper, onError }) {
  const [view, setView] = useState('feeding');

  return (
    <>
      <PillNav
        options={[
          { value: 'feeding', label: 'Feeding' },
          { value: 'sleep',   label: 'Sleep' },
          { value: 'diaper',  label: 'Diaper' },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'feeding' && <FeedingTab logs={feeding} onStart={onStart} onStop={onStop} onDelete={onDeleteFeed} onManualAdd={onManualAdd} onError={onError} />}
      {view === 'sleep'   && <SleepTab logs={sleep} onAdd={onAddSleep} onDelete={onDeleteSleep} onError={onError} />}
      {view === 'diaper'  && <DiaperTab logs={diaper} onAdd={onAddDiaper} onDelete={onDeleteDiaper} onError={onError} />}
    </>
  );
}
