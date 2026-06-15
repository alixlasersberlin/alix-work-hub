import { useEffect, useState } from "react";

const KEY = "alixwork.ai_bg";

export const bootAIBackground = () => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on") document.documentElement.setAttribute("data-ai-bg", "on");
  } catch {
    /* noop */
  }
};

export const useAIBackground = () => {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* noop */
    }
    if (on) document.documentElement.setAttribute("data-ai-bg", "on");
    else document.documentElement.removeAttribute("data-ai-bg");
  }, [on]);

  return { on, setOn, toggle: () => setOn((v) => !v) };
};
