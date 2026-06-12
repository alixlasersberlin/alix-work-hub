// Lightweight i18n for new design/accessibility UI controls.
// Does not touch existing German backend copy.

export type UiLang = 'de' | 'en' | 'fr' | 'es' | 'it' | 'tr' | 'ar' | 'vi';

const LANGS: UiLang[] = ['de', 'en', 'fr', 'es', 'it', 'tr', 'ar', 'vi'];

type Dict = Record<string, string>;

const dict: Record<UiLang, Dict> = {
  de: {
    'display.settings': 'Anzeigeeinstellungen',
    'display.fontSize': 'Schriftgröße',
    'display.small': 'Klein',
    'display.normal': 'Standard',
    'display.large': 'Groß',
    'display.xlarge': 'Extra Groß',
    'display.a11y': 'Barrierefrei',
    'theme.light': 'Hell-Modus',
    'theme.dark': 'Dunkel-Modus',
    'design.premiumDesign': 'Premium Design',
    'design.downloadBackground': 'Background herunterladen',
    'design.switchView': 'Ansicht wechseln',
  },
  en: {
    'display.settings': 'Display settings',
    'display.fontSize': 'Font size',
    'display.small': 'Small',
    'display.normal': 'Standard',
    'display.large': 'Large',
    'display.xlarge': 'Extra large',
    'display.a11y': 'Accessibility',
    'theme.light': 'Light mode',
    'theme.dark': 'Dark mode',
    'design.premiumDesign': 'Premium design',
    'design.downloadBackground': 'Download background',
    'design.switchView': 'Switch view',
  },
  fr: {
    'display.settings': "Réglages d'affichage",
    'display.fontSize': 'Taille de police',
    'display.small': 'Petit',
    'display.normal': 'Standard',
    'display.large': 'Grand',
    'display.xlarge': 'Très grand',
    'display.a11y': 'Accessibilité',
    'theme.light': 'Mode clair',
    'theme.dark': 'Mode sombre',
    'design.premiumDesign': 'Design premium',
    'design.downloadBackground': "Télécharger l'arrière-plan",
    'design.switchView': 'Changer la vue',
  },
  es: {
    'display.settings': 'Ajustes de pantalla',
    'display.fontSize': 'Tamaño de letra',
    'display.small': 'Pequeño',
    'display.normal': 'Estándar',
    'display.large': 'Grande',
    'display.xlarge': 'Muy grande',
    'display.a11y': 'Accesibilidad',
    'theme.light': 'Modo claro',
    'theme.dark': 'Modo oscuro',
    'design.premiumDesign': 'Diseño premium',
    'design.downloadBackground': 'Descargar fondo',
    'design.switchView': 'Cambiar vista',
  },
  it: {
    'display.settings': 'Impostazioni di visualizzazione',
    'display.fontSize': 'Dimensione testo',
    'display.small': 'Piccolo',
    'display.normal': 'Standard',
    'display.large': 'Grande',
    'display.xlarge': 'Molto grande',
    'display.a11y': 'Accessibilità',
    'theme.light': 'Modalità chiara',
    'theme.dark': 'Modalità scura',
    'design.premiumDesign': 'Design premium',
    'design.downloadBackground': 'Scarica sfondo',
    'design.switchView': 'Cambia vista',
  },
  tr: {
    'display.settings': 'Görünüm ayarları',
    'display.fontSize': 'Yazı boyutu',
    'display.small': 'Küçük',
    'display.normal': 'Standart',
    'display.large': 'Büyük',
    'display.xlarge': 'Çok büyük',
    'display.a11y': 'Erişilebilirlik',
    'theme.light': 'Açık mod',
    'theme.dark': 'Koyu mod',
    'design.premiumDesign': 'Premium tasarım',
    'design.downloadBackground': 'Arka planı indir',
    'design.switchView': 'Görünümü değiştir',
  },
  ar: {
    'display.settings': 'إعدادات العرض',
    'display.fontSize': 'حجم الخط',
    'display.small': 'صغير',
    'display.normal': 'افتراضي',
    'display.large': 'كبير',
    'display.xlarge': 'كبير جدًا',
    'display.a11y': 'إمكانية الوصول',
    'theme.light': 'الوضع الفاتح',
    'theme.dark': 'الوضع الداكن',
    'design.premiumDesign': 'تصميم فاخر',
    'design.downloadBackground': 'تنزيل الخلفية',
    'design.switchView': 'تبديل العرض',
  },
  vi: {
    'display.settings': 'Cài đặt hiển thị',
    'display.fontSize': 'Cỡ chữ',
    'display.small': 'Nhỏ',
    'display.normal': 'Tiêu chuẩn',
    'display.large': 'Lớn',
    'display.xlarge': 'Rất lớn',
    'display.a11y': 'Trợ năng',
    'theme.light': 'Chế độ sáng',
    'theme.dark': 'Chế độ tối',
    'design.premiumDesign': 'Thiết kế cao cấp',
    'design.downloadBackground': 'Tải hình nền',
    'design.switchView': 'Đổi chế độ xem',
  },
};

const STORAGE_KEY = 'ui-lang';

export function detectUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as UiLang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'de').toLowerCase().slice(0, 2);
  return (LANGS as string[]).includes(nav) ? (nav as UiLang) : 'de';
}

export function setUiLang(lang: UiLang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
}

export function t(key: string, lang?: UiLang): string {
  const l = lang ?? detectUiLang();
  return dict[l]?.[key] ?? dict.de[key] ?? key;
}
