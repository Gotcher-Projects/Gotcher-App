package com.gotcherapp.api.appointments.dto;

public record AppointmentResponse(
    Long id,
    String appointmentDate,
    String doctorName,
    String appointmentType,
    String notes,
    Boolean isCompleted,
    String createdAt
) {}
