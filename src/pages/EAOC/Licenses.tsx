import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Licenses() {
  return (
    <EaocCrudPage
      title="Lizenzverwaltung"
      subtitle="Basic · Professional · Enterprise · Test · Aktiv / Inaktiv"
      section="licenses"
      fields={[
        { key: "module", label: "Modul" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        { key: "validUntil", label: "Gültig bis" },
      ]}
      columns={["module", "plan", "status", "validUntil"]}
    />
  );
}
