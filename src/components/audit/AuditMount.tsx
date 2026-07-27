import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { auditTracker, trackAudit } from "@/lib/audit/tracker";

/**
 * Mounted once inside AuthProvider. Starts/stops the audit session as the user
 * logs in/out and tracks route changes.
 */
export default function AuditMount() {
  const { user } = useAuth();
  const location = useLocation();
  const started = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (user && !started.current) {
      started.current = true;
      auditTracker.start();
    } else if (!user && started.current) {
      started.current = false;
      auditTracker.stop();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    trackAudit({
      module: location.pathname.split("/")[1] || "root",
      action: "navigate",
      path: location.pathname,
    });
  }, [location.pathname, user]);

  return null;
}
