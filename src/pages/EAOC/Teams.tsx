import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Teams() {
  return (
    <EaocCrudPage
      title="Teams"
      subtitle="Beliebig strukturierbar mit mehreren Teamleitern"
      section="teams"
      fields={[
        { key: "name", label: "Team" },
        { key: "lead", label: "Teamleitung" },
        { key: "members", label: "Mitglieder", type: "number" },
        { key: "location", label: "Standort" },
      ]}
      columns={["name", "lead", "members", "location"]}
    />
  );
}
