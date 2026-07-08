import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Permissions() {
  return (
    <EaocCrudPage
      title="Berechtigungen"
      subtitle="Granular · sehen · erstellen · ändern · löschen · freigeben · exportieren · importieren"
      section="permissions"
      fields={[
        { key: "code", label: "Code" },
        { key: "name", label: "Bezeichnung" },
        { key: "module", label: "Modul" },
        { key: "enabled", label: "Aktiv", type: "checkbox" },
      ]}
      columns={["code", "name", "module", "enabled"]}
    />
  );
}
