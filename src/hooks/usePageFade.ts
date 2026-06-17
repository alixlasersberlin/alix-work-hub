import { useEffect, useState } from "react";

const KEY = "alixwork.page_fade";

export const bootPageFade = () => {
  try {
    // Forced off: no page transitions/fades anymore
    localStorage.setItem(KEY, "off");
    document.documentElement.removeAttribute("data-page-fade");
  } catch {
    /* noop */
  }
};

export const usePageFade = () => {
  const [on, setOn] = useState<boolean>(() => {
    return false;
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, "off");
    } catch {
      /* noop */
    }
    document.documentElement.removeAttribute("data-page-fade");
  }, []);
  return { on, setOn: (_value: boolean) => setOn(false) };
};
