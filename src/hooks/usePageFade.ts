import { useEffect, useState } from "react";

const KEY = "alixwork.page_fade";

export const bootPageFade = () => {
  try {
    const v = localStorage.getItem(KEY);
    // Default on
    if (v === null || v === "on") {
      document.documentElement.setAttribute("data-page-fade", "on");
    }
  } catch {
    /* noop */
  }
};

export const usePageFade = () => {
  const [on, setOn] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === null ? true : v === "on";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* noop */
    }
    if (on) document.documentElement.setAttribute("data-page-fade", "on");
    else document.documentElement.removeAttribute("data-page-fade");
  }, [on]);
  return { on, setOn };
};
