import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Companies() {
  return (
    <EaocCrudPage
      title="Gesellschaften"
      subtitle="Unternehmensgruppe · Rechtsformen · Steuerdaten · Branding-Parent"
      section="companies"
      fields={[
        { key: "name", label: "Name" },
        { key: "legal", label: "Rechtsform" },
        { key: "parent", label: "Mutter (ID)" },
        { key: "city", label: "Ort" },
        { key: "country", label: "Land" },
        { key: "currency", label: "Währung" },
        { key: "tz", label: "Zeitzone" },
        { key: "active", label: "Aktiv", type: "checkbox" },
      ]}
      columns={["name", "legal", "city", "country", "currency", "active"]}
    />
  );
}
