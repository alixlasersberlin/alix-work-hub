import { useParams } from "react-router-dom";
import { getSection } from "@/lib/abic/mock";
import { SectionView } from "@/components/abic/SectionView";

/**
 * Renders a preconfigured ABIC analytics section by URL slug.
 * Usage: <SectionPage sectionKey="sales" /> or via /abic/:section route.
 */
export default function SectionPage({ sectionKey }: { sectionKey?: string }) {
  const params = useParams<{ section?: string }>();
  const key = sectionKey ?? params.section ?? "executive";
  const section = getSection(key);
  if (!section) {
    return <div className="text-muted-foreground">Bereich „{key}" nicht gefunden.</div>;
  }
  return <SectionView section={section} />;
}
