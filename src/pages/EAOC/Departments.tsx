import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Departments() {
  return (
    <EaocCrudPage
      title="Abteilungen"
      subtitle="Sales · Service · Marketing · Technik · Schulung · NiSV · Lieferung · Compliance · Finanzen · Geschäftsleitung"
      section="departments"
      fields={[
        { key: "name", label: "Bezeichnung" },
        { key: "head", label: "Leitung" },
        { key: "email", label: "E-Mail", type: "email" },
      ]}
      columns={["name", "head", "email"]}
    />
  );
}
