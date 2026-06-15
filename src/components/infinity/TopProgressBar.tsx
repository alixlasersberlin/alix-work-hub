import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Phase I-15: Top progress bar that ticks on route changes.
 * Mounts once globally. Respects reduced motion (CSS handles disabling).
 */
export const TopProgressBar = () => {
  const location = useLocation();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(true);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setDone(false);
    setPct(15);

    const t1 = window.setTimeout(() => setPct(55), 80);
    const t2 = window.setTimeout(() => setPct(82), 220);
    const t3 = window.setTimeout(() => setPct(100), 480);
    const t4 = window.setTimeout(() => setDone(true), 760);
    const t5 = window.setTimeout(() => setPct(0), 1080);
    timers.current.push(t1, t2, t3, t4, t5);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, [location.pathname]);

  return (
    <div className="iprog" aria-hidden="true">
      <div
        className="iprog__bar"
        data-state={done ? "done" : "loading"}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default TopProgressBar;
