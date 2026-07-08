import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Integrations() {
  return (
    <EigCrudPage title="Integrationen" subtitle="ERP · CRM · Payments · Shipping · Meetings · Messaging"
      section="integrations"
      fields={[
        { key: "name", label: "Dienst" },
        { key: "type", label: "Typ" },
        { key: "status", label: "Status" },
        { key: "config", label: "Konfiguration", type: "textarea" },
      ]}
      columns={["name","type","status"]} />
  );
}
