import React from "react";

export default function PillNav({ options, active, onChange }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            active === o.value
              ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
