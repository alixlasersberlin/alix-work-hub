import EigCrudPage from "@/components/eig/EigCrudPage";
export default function Errors() {
  return (
    <EigCrudPage title="Fehlerverwaltung" subtitle="Fehlernummer · Modul · Quelle · Priorität · Lösungsvorschlag · Retry"
      section="errors"
      fields={[
        { key: "code", label: "Nummer" },
        { key: "message", label: "Beschreibung" },
        { key: "module", label: "Modul" },
        { key: "source", label: "Quelle" },
        { key: "user", label: "Benutzer" },
        { key: "priority", label: "Priorität" },
        { key: "suggestion", label: "Lösungsvorschlag" },
      ]}
      columns={["code","message","module","source","priority","suggestion"]} />
  );
}
