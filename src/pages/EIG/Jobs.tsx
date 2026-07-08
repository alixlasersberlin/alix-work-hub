import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Jobs() {
  return (
    <EigCrudPage title="Hintergrundjobs" subtitle="Sync · Import · Export · Backup · Reports · AI · Retry · Prioritäten"
      section="jobs"
      fields={[
        { key: "name", label: "Job" },
        { key: "type", label: "Typ" },
        { key: "schedule", label: "Zeitplan (cron)" },
        { key: "priority", label: "Priorität" },
        { key: "lastRun", label: "Letzter Lauf" },
        { key: "status", label: "Status" },
      ]}
      columns={["name","type","schedule","priority","lastRun","status"]} />
  );
}
