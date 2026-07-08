import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Backups() {
  return (
    <EaocCrudPage
      title="Backup"
      subtitle="Automatische und manuelle Backups · Restore vorbereitet · Historie"
      section="backups"
      fields={[
        { key: "name", label: "Name" },
        { key: "type", label: "Typ" },
        { key: "size", label: "Größe" },
        { key: "status", label: "Status" },
        { key: "createdAt", label: "Erstellt" },
      ]}
      columns={["name", "type", "size", "status", "createdAt"]}
    />
  );
}
