import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { CalendarDays, Trash2 } from "lucide-react";

function AppointmentRow({ appt, fmtDate, onUpdate, onDelete, onError }) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleMarkDone() {
    setMarking(true);
    try {
      await onUpdate(appt.id, { isCompleted: true });
    } catch {
      onError('Failed to update appointment');
    }
    setMarking(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(appt.id);
    } catch {
      onError('Failed to delete appointment');
    }
    setDeleting(false);
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${appt.isCompleted ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-emerald-700 text-sm">{fmtDate(appt.appointmentDate)}</span>
          {appt.appointmentType && <span className="text-slate-700 text-sm">{appt.appointmentType}</span>}
          {appt.doctorName && <span className="text-slate-500 text-xs">· {appt.doctorName}</span>}
          {appt.isCompleted && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">Done</span>}
        </div>
        {appt.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{appt.notes}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!appt.isCompleted && (
          <button
            onClick={handleMarkDone}
            disabled={marking}
            className="text-xs text-emerald-700 border border-emerald-300 rounded px-2 py-1 hover:bg-emerald-100 disabled:opacity-50"
          >
            {marking ? '…' : 'Mark Done'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-slate-400 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AppointmentTab({ appointments, onAdd, onUpdate, onDelete, onError }) {
  const [form, setForm] = useState({ appointmentDate: '', doctorName: '', appointmentType: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.appointmentDate) { onError('Appointment date is required'); return; }
    setSaving(true);
    try {
      await onAdd({ ...form, isCompleted: false });
      setForm({ appointmentDate: '', doctorName: '', appointmentType: '', notes: '' });
    } catch {
      onError('Failed to save appointment');
    }
    setSaving(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter(a => a.appointmentDate >= today && !a.isCompleted);
  const past = appointments.filter(a => a.appointmentDate < today || a.isCompleted);

  function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl md:col-span-1">
        <CardContent className="p-5">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            Add Appointment
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.appointmentDate}
                onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))}
                className="bg-white"
                required
              />
            </div>
            <div>
              <Label>Doctor / Provider</Label>
              <Input
                value={form.doctorName}
                onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))}
                placeholder="e.g., Dr. Smith"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Appointment Type</Label>
              <Input
                value={form.appointmentType}
                onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))}
                placeholder="e.g., 2-Month Checkup"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                rows={3}
                className="bg-white"
              />
            </div>
            <LoadingButton loading={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Save Appointment
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-5">
        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming appointments</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(a => (
                  <AppointmentRow key={a.id} appt={a} fmtDate={fmtDate} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-500 mb-3">
              Past / Completed ({past.length})
            </h3>
            {past.length === 0 ? (
              <p className="text-sm text-slate-400">None yet</p>
            ) : (
              <div className="space-y-2">
                {[...past].reverse().map(a => (
                  <AppointmentRow key={a.id} appt={a} fmtDate={fmtDate} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
