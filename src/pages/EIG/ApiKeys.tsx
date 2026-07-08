import EigCrudPage from "@/components/eig/EigCrudPage";
export default function ApiKeys() {
  return (
    <EigCrudPage title="API-Schlüssel" subtitle="Scopes · Ablauf · Rotation · Widerruf"
      section="api_keys"
      fields={[
        { key: "name", label: "Name" },
        { key: "scopes", label: "Scopes" },
        { key: "masked", label: "Schlüssel (maskiert)" },
        { key: "expiresAt", label: "Ablauf" },
        { key: "createdBy", label: "Erstellt von" },
      ]}
      columns={["name","scopes","masked","expiresAt","createdBy"]} />
  );
}
