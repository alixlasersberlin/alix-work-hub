import EaocCrudPage from "@/components/eaoc/EaocCrudPage";
export default function Branding() {
  return (
    <EaocCrudPage
      title="Branding"
      subtitle="Logo · Farben · Schrift · Favicon · Login · E-Mail · PDF · Portalfarben"
      section="branding"
      fields={[
        { key: "tenantName", label: "Mandant" },
        { key: "logo", label: "Logo (URL)" },
        { key: "primary", label: "Primärfarbe" },
        { key: "secondary", label: "Sekundärfarbe" },
        { key: "font", label: "Schrift" },
        { key: "theme", label: "Theme (dark/light)" },
      ]}
      columns={["tenantName", "primary", "secondary", "font", "theme"]}
    />
  );
}
