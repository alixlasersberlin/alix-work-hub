import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Locations() {
  return (
    <EaocCrudPage
      title="Standorte"
      subtitle="Berlin · Wien · Dubai · Miami · Riga u. w."
      section="locations"
      fields={[
        { key: "name", label: "Name" },
        { key: "address", label: "Adresse" },
        { key: "phone", label: "Telefon" },
        { key: "country", label: "Land" },
        { key: "tz", label: "Zeitzone" },
        { key: "hours", label: "Öffnungszeiten" },
      ]}
      columns={["name", "address", "country", "phone", "tz"]}
    />
  );
}
