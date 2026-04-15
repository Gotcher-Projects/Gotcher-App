# Session 3 — Doctor Appointment Reminders
**Status:** Pending
**Branch:** `quick-wins`
**Depends on:** S2 complete (V14 must exist before V15)

## Goal
Add/edit/delete doctor appointments per baby. Surface upcoming appointments on the Dashboard tab.

## Files to Change

### Backend
| File | Change |
|------|--------|
| `Backend/db/migration/V15__create_appointments.sql` | New — appointments table |
| `Backend/src/main/java/com/gotcherapp/api/appointments/Appointment.java` | New — entity record |
| `Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentRequest.java` | New — request DTO |
| `Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentResponse.java` | New — response DTO |
| `Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentService.java` | New — CRUD |
| `Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentController.java` | New — REST endpoints |

### Frontend
| File | Change |
|------|--------|
| `Frontend/src/components/BabySteps.jsx` | Add appointment state + API calls, AppointmentTab component, tab trigger, upcoming card in DashboardTab |

## Key Decisions

### Schema
```sql
CREATE TABLE appointments (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  doctor_name     VARCHAR(100),
  appointment_type VARCHAR(100),   -- e.g. "2-Month Checkup", "Sick Visit"
  notes           TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON appointments(baby_profile_id, appointment_date);
```

### API endpoints
- `GET    /appointments`        → list all for baby profile, sorted by date asc
- `POST   /appointments`        → create new
- `PATCH  /appointments/{id}`   → update (same DTO as create, all fields optional)
- `DELETE /appointments/{id}`   → delete
- All endpoints: verify `baby_profile_id` belongs to the authenticated user before any write/delete.

### AppointmentRequest fields
```java
record AppointmentRequest(
  String appointmentDate,   // "YYYY-MM-DD"
  String doctorName,
  String appointmentType,
  String notes,
  Boolean isCompleted
) {}
```

### AppointmentResponse fields
All AppointmentRequest fields + `id` (Long) + `createdAt` (String).

### AppointmentService
Use JdbcTemplate + BabyProfileRepository (same as MilestoneService, GrowthService patterns).
- `findAll(userId)` — join to baby_profiles to scope to user, ORDER BY appointment_date ASC
- `create(userId, req)` — INSERT, return the new row
- `update(userId, id, req)` — UPDATE only non-null fields; verify ownership first
- `delete(userId, id)` — verify ownership, then DELETE

### SecurityConfig
No change — `/appointments/**` is covered by `.anyRequest().authenticated()`.

### Frontend state
```js
const [appointments, setAppointments] = useState([]);
```
Load on mount alongside journal/growth: `GET /appointments`.

### AppointmentTab UI
- Left column (1/3): Add new appointment form
  - Date picker (required), Doctor name, Appointment type, Notes textarea
  - "Save Appointment" button
- Right column (2/3): List of appointments
  - Two sections: **Upcoming** (appointment_date >= today, is_completed = false) and **Past / Completed**
  - Each row: date + type + doctor name + notes snippet + "Mark Done" toggle + delete button
  - "Mark Done" calls PATCH with `{ isCompleted: true }` and moves it to Past section
- Color scheme: emerald-600

### Dashboard upcoming card
In `DashboardTab` (after the milestones section, around line 555), add a small card:
- Title: "Upcoming Appointments" with a calendar icon
- Show next 3 upcoming (date >= today, not completed), sorted by date
- If none: "No upcoming appointments" placeholder
- Each row: date formatted as "Apr 18" + appointment type + doctor name
- Prop: pass `appointments` down to DashboardTab

### Tab insertion
Add tab trigger + content after Poop, before Marketplace (line ~349 area in BabySteps.jsx).

## Verification
- [ ] `./gradlew bootRun` starts without Flyway errors (V15 migration applies)
- [ ] `POST /appointments` creates a record visible in `GET /appointments`
- [ ] Dashboard shows next 3 upcoming appointments after adding them
- [ ] "Mark Done" moves appointment from Upcoming to Past section
- [ ] Delete removes appointment from list
- [ ] Appointments scoped per user — logging in as a different user shows empty list
- [ ] No console errors
