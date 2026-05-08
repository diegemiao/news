/**
 * Prune archive entries older than retention_days
 */
function pruneArchive(archive, retentionDays = 30) {
  const cutoff = (Date.now() / 1000) - (retentionDays * 86400);
  let removed = 0;

  for (const feedId of Object.keys(archive.seen || {})) {
    const feedSeen = archive.seen[feedId];
    for (const key of Object.keys(feedSeen)) {
      if (feedSeen[key] < cutoff) {
        delete feedSeen[key];
        removed++;
      }
    }
    // Remove empty feed entries
    if (Object.keys(feedSeen).length === 0) {
      delete archive.seen[feedId];
    }
  }

  archive.last_pruned = new Date().toISOString();
  return removed;
}

module.exports = { pruneArchive };
