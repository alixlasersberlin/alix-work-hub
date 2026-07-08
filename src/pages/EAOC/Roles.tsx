import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Roles() {
  return (
    <EaocCrudPage
      title="Rollen"
      subtitle="Standard- und eigene Rollen inkl. Portalrollen"
      section="roles"
      fields={[
        { key: "name", label: "Name" },
        { key: "scope", label: "Scope" },
        { key: "description", label: "Beschreibung", type: "textarea" },
      ]}
      columns={["name", "scope", "description"]}
    />
  );
}
