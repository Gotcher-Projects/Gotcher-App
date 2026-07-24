package com.gotcherapp.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling  // print pr3 — hourly TTL sweep of expired print_pdfs rows
public class GotcherAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(GotcherAppApplication.class, args);
    }
}
