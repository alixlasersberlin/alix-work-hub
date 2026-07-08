import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Mappings() {
  return (
    <EigCrudPage title="Datenmapping" subtitle="Quelle → Transformation → Ziel · Feldmapping · Validierung"
      section="mappings"
      fields={[
        { key: "name", label: "Name" },
        { key: "source", label: "Quelle" },
        { key: "target", label: "Ziel" },
        { key: "rules", label: "Regeln", type: "number" },
        { key: "status", label: "Status" },
      ]}
      columns={["name","source","target","rules","status"]} />
  );
}
