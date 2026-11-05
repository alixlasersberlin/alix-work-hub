-- Read-only regression check against the configured external profile fetcher.
-- A wrong interval, inactive job or missing job makes this assertion fail.
select 1 / case when count(*) = 1 then 1 else 0 end as hourly_profile_schedule_verified
from cron.job
where jobid = 59
  and jobname = 'alixsmart-sync-poll-5min'
  and schedule = '0 * * * *'
  and active
  and command like '%alixsmart-sync-poll%';