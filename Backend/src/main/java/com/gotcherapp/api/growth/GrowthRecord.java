package com.gotcherapp.api.growth;

import java.math.BigDecimal;

public record GrowthRecord(
    Long id,
    String recordedDate,
    BigDecimal weightLbs,
    BigDecimal heightIn,
    BigDecimal headIn,
    String notes
) {}
