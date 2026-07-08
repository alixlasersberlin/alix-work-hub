import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Integrations() {
  return (
    <EaocCrudPage
      title="Integrationen"
      subtitle="Microsoft 365 · Google Workspace · Exchange · Twilio · WhatsApp · Zoom · Teams · Stripe u. w."
      section="integrations"
      fields={[
        { key: "name", label: "Dienst" },
        { key: "type", label: "Typ" },
        { key: "status", label: "Status" },
        { key: "config", label: "Konfiguration", type: "textarea" },
      ]}
      columns={["name", "type", "status"]}
    />
  );
}
