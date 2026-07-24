package com.gotcherapp.api.firsttimes.dto;

import java.util.List;

// Full ordered list of additional-photo ids for a first time. The photos are renumbered
// sort_order 0..n-1 in the given order.
public record ReorderPhotosRequest(
    List<Long> orderedIds
) {}
