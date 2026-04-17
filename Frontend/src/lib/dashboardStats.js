/**
 * Pure stat-helper functions used by DashboardTab.
 * Extracted here so they can be unit-tested without rendering React.
 */

export function fmtDuration(secs) {
  if (!secs || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

/**
 * Compute feeding stats for the dashboard.
 * @param {Array} feeding - array of feeding log objects
 * @returns {{ mostRecentFeed, todayFeeds, avgGapStr }}
 */
export function computeFeedingStats(feeding) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const completedFeeds = (feeding || []).filter(l => l.endedAt);
  const todayFeeds = completedFeeds.filter(l => new Date(l.startedAt) >= midnight);
  const mostRecentFeed = [...completedFeeds].sort(
    (a, b) => new Date(b.endedAt) - new Date(a.endedAt)
  )[0] || null;

  let avgGapStr = null;
  if (todayFeeds.length >= 2) {
    const sorted = [...todayFeeds].sort(
      (a, b) => new Date(a.startedAt) - new Date(b.startedAt)
    );
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGap += (new Date(sorted[i].startedAt) - new Date(sorted[i - 1].startedAt)) / 60000;
    }
    const avgMins = Math.round(totalGap / (sorted.length - 1));
    avgGapStr =
      avgMins < 60
        ? `${avgMins}m`
        : `${Math.floor(avgMins / 60)}h ${avgMins % 60 || 0}m`;
  }

  return { mostRecentFeed, todayFeeds, avgGapStr };
}

/**
 * Compute sleep stats for the last 24 hours.
 * @param {Array} sleep - array of sleep log objects
 * @returns {{ completedSleep, totalSleepSecs, longestSleepSecs, mostRecentSleep }}
 */
export function computeSleepStats(sleep) {
  const cutoff24h = Date.now() - 24 * 3600 * 1000;

  const completedSleep = (sleep || []).filter(
    l => l.endedAt && new Date(l.startedAt) >= new Date(cutoff24h)
  );

  const totalSleepSecs = completedSleep.reduce(
    (s, l) => s + (new Date(l.endedAt) - new Date(l.startedAt)) / 1000,
    0
  );

  const longestSleepSecs = completedSleep.reduce((max, l) => {
    const d = (new Date(l.endedAt) - new Date(l.startedAt)) / 1000;
    return d > max ? d : max;
  }, 0);

  const mostRecentSleep =
    [...completedSleep].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0] || null;

  return { completedSleep, totalSleepSecs, longestSleepSecs, mostRecentSleep };
}
