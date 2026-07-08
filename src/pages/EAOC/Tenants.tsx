import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Tenants() {
  return (
    <EaocCrudPage
      title="Mandanten"
      subtitle="Mandantenfähigkeit · Brand · Farben · Domänen · Lizenzen"
      section="tenants"
      fields={[
        { key: "name", label: "Mandantenname" },
        { key: "brand", label: "Brand" },
        { key: "primaryColor", label: "Primärfarbe" },
        { key: "locale", label: "Sprache" },
        { key: "currency", label: "Währung" },
        { key: "domain", label: "Domäne" },
        { key: "active", label: "Aktiv", type: "checkbox" },
      ]}
      columns={["name", "brand", "primaryColor", "locale", "currency", "active"]}
    />
  );
}
