-- Read-only regression for the existing schedules whose caller was secured.
WITH expected(jobname, schedule, active) AS (
  VALUES ('ac-outreach-engine-hourly','5 * * * *',true),
         ('ticket-auto-close-daily','15 3 * * *',true),
         ('ac-voice-analyze-hourly','15 * * * *',true)
)
SELECT count(*) = 3 AND bool_and(j.schedule = e.schedule AND j.active = e.active) AS unchanged
FROM expected e LEFT JOIN cron.job j ON j.jobname = e.jobname;