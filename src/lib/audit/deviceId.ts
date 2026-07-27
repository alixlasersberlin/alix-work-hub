// Persistent device fingerprint (stored in localStorage). Anonymous UUID.
const KEY = "alix_audit_device_id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export function collectDeviceInfo() {
  const ua = navigator.userAgent;
  const parseBrowser = () => {
    const m = ua.match(/(Chrome|Firefox|Safari|Edge|OPR)\/([\d.]+)/);
    if (m) return { browser: m[1] === "OPR" ? "Opera" : m[1], browser_version: m[2] };
    return { browser: "unknown", browser_version: "" };
  };
  const parseOs = () => {
    if (/Windows NT ([\d.]+)/.test(ua)) return { os: "Windows", os_version: RegExp.$1 };
    if (/Mac OS X ([\d_]+)/.test(ua)) return { os: "macOS", os_version: RegExp.$1.replace(/_/g, ".") };
    if (/Android ([\d.]+)/.test(ua)) return { os: "Android", os_version: RegExp.$1 };
    if (/iPhone OS ([\d_]+)/.test(ua)) return { os: "iOS", os_version: RegExp.$1.replace(/_/g, ".") };
    if (/Linux/.test(ua)) return { os: "Linux", os_version: "" };
    return { os: "unknown", os_version: "" };
  };
  return {
    device_id: getDeviceId(),
    user_agent: ua,
    ...parseBrowser(),
    ...parseOs(),
    screen_resolution: `${screen.width}x${screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_mobile: /Mobi|Android/i.test(ua),
    cookie_id: null as string | null,
  };
}
