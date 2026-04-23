package com.gotcherapp.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class EmailService {

    private final Optional<JavaMailSender> mailSender;

    @Value("${app.smtp.from:}")
    private String fromEmail;

    public EmailService(Optional<JavaMailSender> mailSender) {
        this.mailSender = mailSender;
    }

    public void send(String to, String subject, String body) {
        if (mailSender.isEmpty() || fromEmail.isBlank()) {
            System.out.printf("[Email] SMTP not configured. Would send to: %s | Subject: %s%n", to, subject);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromEmail);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.get().send(msg);
    }
}
