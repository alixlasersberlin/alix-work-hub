import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Plugins() {
  return (
    <EigCrudPage title="Plugins" subtitle="Manifest · Version · Berechtigungen · Aktivieren / Deaktivieren · Updates"
      section="plugins"
      fields={[
        { key: "name", label: "Name" },
        { key: "vendor", label: "Anbieter" },
        { key: "version", label: "Version" },
        { key: "scopes", label: "Scopes" },
        { key: "status", label: "Status" },
      ]}
      columns={["name","vendor","version","scopes","status"]} />
  );
}
