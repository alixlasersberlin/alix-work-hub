import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Jobs() {
  return (
    <EaocCrudPage
      title="Aufgabenplanung"
      subtitle="Hintergrundjobs: Kalender-Sync, Backups, Mail, Erinnerungen, Berichte, Bereinigung"
      section="jobs"
      fields={[
        { key: "name", label: "Job" },
        { key: "schedule", label: "Zeitplan (cron)" },
        { key: "lastRun", label: "Letzter Lauf" },
        { key: "status", label: "Status" },
      ]}
      columns={["name", "schedule", "lastRun", "status"]}
    />
  );
}
