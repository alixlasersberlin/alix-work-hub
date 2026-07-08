import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Users() {
  return (
    <EaocCrudPage
      title="Benutzer"
      subtitle="Import · Export · mehrere Rollen und Gesellschaften"
      section="users"
      fields={[
        { key: "name", label: "Name" },
        { key: "email", label: "E-Mail", type: "email" },
        { key: "role", label: "Rolle" },
        { key: "department", label: "Abteilung" },
        { key: "location", label: "Standort" },
        { key: "locale", label: "Sprache" },
        { key: "status", label: "Status" },
      ]}
      columns={["name", "email", "role", "department", "location", "status"]}
    />
  );
}
