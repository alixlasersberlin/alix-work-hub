import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Queues() {
  return (
    <EigCrudPage title="Queue System" subtitle="Job · Priority · Retry · Dead Letter · Monitoring"
      section="queues"
      fields={[
        { key: "name", label: "Name" },
        { key: "type", label: "Typ" },
        { key: "depth", label: "Backlog", type: "number" },
        { key: "retries", label: "Retries", type: "number" },
      ]}
      columns={["name","type","depth","retries"]} />
  );
}
