import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Webhooks() {
  return (
    <EaocCrudPage
      title="Webhooks"
      subtitle="Events · Retry · Logging · Testfunktion"
      section="webhooks"
      fields={[
        { key: "name", label: "Name" },
        { key: "url", label: "URL" },
        { key: "events", label: "Events" },
        { key: "status", label: "Status" },
        { key: "retries", label: "Retries", type: "number" },
      ]}
      columns={["name", "url", "events", "status", "retries"]}
    />
  );
}
