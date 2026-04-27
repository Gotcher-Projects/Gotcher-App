import React from "react";

export default function PillNav({ options, active, onChange, activeClass = 'bg-primary/10 border-primary/30 text-primary' }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            active === o.value
              ? activeClass
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
