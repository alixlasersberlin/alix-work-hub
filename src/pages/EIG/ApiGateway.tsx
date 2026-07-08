import EigCrudPage from "@/components/eig/EigCrudPage";
export default function ApiGateway() {
  return (
    <EigCrudPage title="API Gateway" subtitle="Interne und externe APIs · Versionierung · Rate Limits"
      section="apis"
      fields={[
        { key: "name", label: "Name" },
        { key: "version", label: "Version" },
        { key: "basePath", label: "Base Path" },
        { key: "auth", label: "Auth" },
        { key: "rateLimit", label: "Rate Limit" },
        { key: "scope", label: "Scope" },
        { key: "status", label: "Status" },
      ]}
      columns={["name","version","basePath","auth","rateLimit","status"]} />
  );
}
