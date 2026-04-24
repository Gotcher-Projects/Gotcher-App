package com.gotcherapp.api.appointments.dto;

public record AppointmentRequest(
    String appointmentDate,
    String appointmentTime,
    String doctorName,
    String appointmentType,
    String notes,
    Boolean isCompleted
) {}
