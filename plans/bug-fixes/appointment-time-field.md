# Appointment Time Field
**Status:** Complete
**Area:** Appointments — DB migration + AppointmentService + AppointmentTab

## Goal
Add an optional time field to doctor appointments so users can record what time the appointment is, not just the date.

## Affected Files

### Backend — create
- `Backend/db/migration/V21__add_appointment_time.sql`

### Backend — edit
- `Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentRequest.java` — add `appointmentTime`
- `Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentResponse.java` — add `appointmentTime`
- `Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentService.java` — SELECT, INSERT, UPDATE, mapRow

### Frontend — edit
- `Frontend/src/components/tabs/AppointmentTab.jsx` — time input in form + display in AppointmentRow
- `Frontend/src/components/tabs/DashboardTab.jsx` — check upcoming appointments preview, add time if displayed there

## Steps

### 1. Migration — V21
```sql
ALTER TABLE appointments ADD COLUMN appointment_time TIME;
```
Nullable — existing appointments have no time and that's fine.

### 2. AppointmentRequest.java
Add `String appointmentTime` field:
```java
public record AppointmentRequest(
    String appointmentDate,
    String appointmentTime,
    String doctorName,
    String appointmentType,
    String notes,
    Boolean isCompleted
) {}
```

### 3. AppointmentResponse.java
Add `String appointmentTime` field after `appointmentDate`:
```java
public record AppointmentResponse(
    Long id,
    String appointmentDate,
    String appointmentTime,
    String doctorName,
    String appointmentType,
    String notes,
    Boolean isCompleted,
    String createdAt
) {}
```

### 4. AppointmentService.java

**findAll + update SELECT** — add `appointment_time` to all `SELECT` clauses.

**create INSERT** — add column and cast:
```sql
INSERT INTO appointments (baby_profile_id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed)
VALUES (?, ?::date, ?::time, ?, ?, ?, ?)
RETURNING id, appointment_date, appointment_time, ...
```
Pass `req.appointmentTime()` — null is fine, Postgres accepts null for `?::time`.

**update SET clause** — add:
```java
if (req.appointmentTime() != null) { setClauses.add("appointment_time = ?::time"); params.add(req.appointmentTime()); }
```

**mapRow** — add:
```java
Object at = row.get("appointment_time");
// include at != null ? at.toString() : null as appointmentTime in the constructor
```

### 5. AppointmentTab.jsx

**Form state** — add `appointmentTime: ''` to initial state and reset.

**Time input** — add after the date field:
```jsx
<div>
  <Label>Time (optional)</Label>
  <Input
    type="time"
    value={form.appointmentTime}
    onChange={e => setForm(f => ({ ...f, appointmentTime: e.target.value }))}
    className="bg-white"
  />
</div>
```

**onAdd call** — `appointmentTime` is already spread via `{ ...form }`, no extra change needed.

**AppointmentRow display** — add time next to the date when present:
```jsx
<span className="font-medium text-emerald-700 text-sm">
  {fmtDate(appt.appointmentDate)}
  {appt.appointmentTime && ` · ${fmtTime(appt.appointmentTime)}`}
</span>
```

Add a `fmtTime` helper at the top of the file:
```js
const fmtTime = t => new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
```

### 6. DashboardTab.jsx
Check the upcoming appointments preview — if it renders appointment date, add time display in the same pattern as AppointmentRow above.

## Definition of Done
- [ ] Existing appointments load without errors (time is null, nothing breaks)
- [ ] New appointment can be saved with or without a time
- [ ] Time displays correctly in the upcoming and past lists
- [ ] DashboardTab upcoming preview also shows time when present
