package com.gotcherapp.api.appointments;

public record Appointment(
    Long id,
    Long babyProfileId,
    String appointmentDate,
    String doctorName,
    String appointmentType,
    String notes,
    Boolean isCompleted,
    String createdAt
) {}
