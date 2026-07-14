-- Jobs 52/53 (mobile-reminder-*) verwenden vault.decrypted_secrets für CRON_SECRET
-- und erzeugen dabei ungültiges JSON ("invalid input syntax for type json").
-- Die identischen Jobs 54/55 (reminder-*-{5m,1m}) laufen sauber ohne Vault → Duplikate entfernen.
select cron.unschedule('mobile-reminder-materializer');
select cron.unschedule('mobile-reminder-scheduler');