import React, { useState } from "react";
import PillNav from "@/components/ui/PillNav";
import FeedingTab from "./FeedingTab";
import SleepTab from "./SleepTab";
import PoopTab from "./PoopTab";

export default function TrackTab({ feeding, sleep, poop, onStart, onStop, onDeleteFeed, onManualAdd, onAddSleep, onDeleteSleep, onAddPoop, onDeletePoop, onError }) {
  const [view, setView] = useState('feeding');

  return (
    <>
      <PillNav
        options={[
          { value: 'feeding', label: 'Feeding' },
          { value: 'sleep',   label: 'Sleep' },
          { value: 'poop',    label: 'Poop' },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'feeding' && <FeedingTab logs={feeding} onStart={onStart} onStop={onStop} onDelete={onDeleteFeed} onManualAdd={onManualAdd} onError={onError} />}
      {view === 'sleep'   && <SleepTab logs={sleep} onAdd={onAddSleep} onDelete={onDeleteSleep} onError={onError} />}
      {view === 'poop'    && <PoopTab logs={poop} onAdd={onAddPoop} onDelete={onDeletePoop} onError={onError} />}
    </>
  );
}
