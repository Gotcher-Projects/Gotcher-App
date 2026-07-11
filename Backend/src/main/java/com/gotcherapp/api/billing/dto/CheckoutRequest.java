package com.gotcherapp.api.billing.dto;

/**
 * Body of POST /billing/checkout.
 * bookId is required for the share SKUs (share_only, bundle_share_150) and must be absent for the
 * credit packs — enforced in BillingService, not here.
 */
public record CheckoutRequest(String sku, Long bookId) {}
