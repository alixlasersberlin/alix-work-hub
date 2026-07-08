import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function ApiKeys() {
  return (
    <EaocCrudPage
      title="API-Schlüssel"
      subtitle="Alle APIs zentral: Scopes · Ablauf · Statistik · Widerruf"
      section="api_keys"
      fields={[
        { key: "name", label: "Name" },
        { key: "scopes", label: "Scopes" },
        { key: "masked", label: "Schlüssel (maskiert)" },
        { key: "createdBy", label: "Erstellt von" },
        { key: "expiresAt", label: "Ablauf" },
        { key: "lastUsed", label: "Zuletzt verwendet" },
      ]}
      columns={["name", "scopes", "masked", "expiresAt", "lastUsed"]}
    />
  );
}
