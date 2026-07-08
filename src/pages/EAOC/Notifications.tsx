import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Notifications() {
  return (
    <EaocCrudPage
      title="Benachrichtigungsverwaltung"
      subtitle="E-Mail · SMS · WhatsApp · Push · Teams · Webhook"
      section="notifications"
      fields={[
        { key: "channel", label: "Kanal" },
        { key: "template", label: "Vorlage" },
        { key: "enabled", label: "Aktiv", type: "checkbox" },
      ]}
      columns={["channel", "template", "enabled"]}
    />
  );
}
