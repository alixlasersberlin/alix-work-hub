import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Webhooks() {
  return (
    <EigCrudPage title="Webhooks" subtitle="Events · Retry · Signaturen · Historie · Testversand"
      section="webhooks"
      fields={[
        { key: "name", label: "Name" },
        { key: "url", label: "URL" },
        { key: "events", label: "Events" },
        { key: "retries", label: "Retries", type: "number" },
        { key: "signed", label: "Signiert", type: "checkbox" },
        { key: "status", label: "Status" },
      ]}
      columns={["name","url","events","retries","signed","status"]} />
  );
}
