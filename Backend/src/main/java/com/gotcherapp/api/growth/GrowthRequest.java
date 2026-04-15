package com.gotcherapp.api.growth;

import java.math.BigDecimal;

public record GrowthRequest(
    String recordedDate,
    BigDecimal weightLbs,
    BigDecimal heightIn,
    BigDecimal headIn,
    String notes
) {}
