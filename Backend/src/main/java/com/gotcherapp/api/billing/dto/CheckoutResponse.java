package com.gotcherapp.api.billing.dto;

/** Response of POST /billing/checkout — the Stripe-hosted checkout URL the browser is sent to. */
public record CheckoutResponse(String url) {}
