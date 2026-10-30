type JobStall = { stalled?: boolean; queued_minutes?: number | null }

/** What to tell the admin about a sync job that has been queued with nothing to run it, if anything. */
export function stalledLabel(job: JobStall): string | null {
  if (!job.stalled) return null
  return job.queued_minutes == null ? 'No worker picked this up' : `No worker picked this up for ${job.queued_minutes} min`
}
