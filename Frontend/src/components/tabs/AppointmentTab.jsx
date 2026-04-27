import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";

const fmtTime = t => new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function AppointmentRow({ appt, fmtDate, onUpdate, onDelete, onError }) {
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  function openEdit() {
    setEditForm({
      appointmentDate: appt.appointmentDate || '',
      appointmentTime: appt.appointmentTime || '',
      doctorName: appt.doctorName || '',
      appointmentType: appt.appointmentType || '',
      notes: appt.notes || '',
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    setEditSaving(true);
    try {
      await onUpdate(appt.id, editForm);
      setEditOpen(false);
    } catch {
      onError('Failed to update appointment');
    }
    setEditSaving(false);
  }

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
    <>
      <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${appt.isCompleted ? 'bg-muted/30 border-border opacity-70' : 'bg-color-success/10 border-color-success/30'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-color-success text-sm">
              {fmtDate(appt.appointmentDate)}
              {appt.appointmentTime && ` · ${fmtTime(appt.appointmentTime)}`}
            </span>
            {appt.appointmentType && <span className="text-foreground text-sm">{appt.appointmentType}</span>}
            {appt.doctorName && <span className="text-muted-foreground text-xs">· {appt.doctorName}</span>}
            {appt.isCompleted && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Done</span>}
          </div>
          {appt.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{appt.notes}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!appt.isCompleted && (
            <button
              onClick={handleMarkDone}
              disabled={marking}
              className="text-xs text-color-success border border-color-success/40 rounded px-2 py-1 hover:bg-color-success/10 disabled:opacity-50"
            >
              {marking ? '…' : 'Mark Done'}
            </button>
          )}
          <button
            onClick={openEdit}
            className="text-muted-foreground hover:text-primary disabled:opacity-50"
            title="Edit appointment"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Appointment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={editForm.appointmentDate}
                onChange={e => setEditForm(f => ({ ...f, appointmentDate: e.target.value }))}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="time"
                value={editForm.appointmentTime}
                onChange={e => setEditForm(f => ({ ...f, appointmentTime: e.target.value }))}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Doctor / Provider</Label>
              <Input
                value={editForm.doctorName}
                onChange={e => setEditForm(f => ({ ...f, doctorName: e.target.value }))}
                placeholder="e.g., Dr. Smith"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Appointment Type</Label>
              <Input
                value={editForm.appointmentType}
                onChange={e => setEditForm(f => ({ ...f, appointmentType: e.target.value }))}
                placeholder="e.g., 2-Month Checkup"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                rows={3}
                className="bg-white"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <LoadingButton
                loading={editSaving}
                onClick={handleSaveEdit}
                disabled={!editForm.appointmentDate}
                className="flex-1"
              >
                Save Changes
              </LoadingButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AppointmentTab({ appointments, onAdd, onUpdate, onDelete, onError }) {
  const [form, setForm] = useState({ appointmentDate: '', appointmentTime: '', doctorName: '', appointmentType: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.appointmentDate) { onError('Appointment date is required'); return; }
    setSaving(true);
    try {
      await onAdd({ ...form, isCompleted: false });
      setForm({ appointmentDate: '', appointmentTime: '', doctorName: '', appointmentType: '', notes: '' });
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
      <Card className="shadow-xl rounded-2xl md:col-span-1 md:sticky md:top-6 md:self-start">
        <CardContent className="p-5">
          <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-color-success" />
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
              <Label>Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="time"
                value={form.appointmentTime}
                onChange={e => setForm(f => ({ ...f, appointmentTime: e.target.value }))}
                className="bg-white"
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
            <LoadingButton loading={saving} className="w-full">
              Save Appointment
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-5">
        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-color-success" />
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
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
            <h3 className="font-display font-semibold text-muted-foreground mb-3">
              Past / Completed ({past.length})
            </h3>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet</p>
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
