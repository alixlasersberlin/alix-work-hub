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
    'theme.toggle': 'Design umschalten',
    'design.premiumDesign': 'Premium Design',
    'design.downloadBackground': 'Background herunterladen',
    'design.switchView': 'Ansicht wechseln',
    'experience.title': 'Experience Mode',
    'experience.classic': 'Classic',
    'experience.premium': 'Premium',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Aktuelles AlixWork Design',
    'experience.premiumDesc': 'Glassmorphism · Premium Cards',
    'experience.megaDesc': '3D · Mission Control · Flagship',
    'experience.download': 'Premium Background herunterladen',
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
    'theme.toggle': 'Toggle theme',
    'design.premiumDesign': 'Premium design',
    'design.downloadBackground': 'Download background',
    'design.switchView': 'Switch view',
    'experience.title': 'Experience mode',
    'experience.classic': 'Classic',
    'experience.premium': 'Premium',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Current AlixWork design',
    'experience.premiumDesc': 'Glassmorphism · premium cards',
    'experience.megaDesc': '3D · mission control · flagship',
    'experience.download': 'Download premium background',
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
    'theme.toggle': 'Changer de thème',
    'design.premiumDesign': 'Design premium',
    'design.downloadBackground': "Télécharger l'arrière-plan",
    'design.switchView': 'Changer la vue',
    'experience.title': 'Mode Experience',
    'experience.classic': 'Classique',
    'experience.premium': 'Premium',
    'experience.mega': 'Méga',
    'experience.classicDesc': 'Design AlixWork actuel',
    'experience.premiumDesc': 'Glassmorphisme · cartes premium',
    'experience.megaDesc': '3D · centre de contrôle · flagship',
    'experience.download': "Télécharger l'arrière-plan premium",
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
    'theme.toggle': 'Cambiar tema',
    'design.premiumDesign': 'Diseño premium',
    'design.downloadBackground': 'Descargar fondo',
    'design.switchView': 'Cambiar vista',
    'experience.title': 'Modo Experience',
    'experience.classic': 'Clásico',
    'experience.premium': 'Premium',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Diseño actual de AlixWork',
    'experience.premiumDesc': 'Glassmorfismo · tarjetas premium',
    'experience.megaDesc': '3D · centro de control · flagship',
    'experience.download': 'Descargar fondo premium',
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
    'theme.toggle': 'Cambia tema',
    'design.premiumDesign': 'Design premium',
    'design.downloadBackground': 'Scarica sfondo',
    'design.switchView': 'Cambia vista',
    'experience.title': 'Modalità Experience',
    'experience.classic': 'Classico',
    'experience.premium': 'Premium',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Design AlixWork attuale',
    'experience.premiumDesc': 'Glassmorfismo · card premium',
    'experience.megaDesc': '3D · centro di controllo · flagship',
    'experience.download': 'Scarica sfondo premium',
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
    'theme.toggle': 'Tema değiştir',
    'design.premiumDesign': 'Premium tasarım',
    'design.downloadBackground': 'Arka planı indir',
    'design.switchView': 'Görünümü değiştir',
    'experience.title': 'Experience modu',
    'experience.classic': 'Klasik',
    'experience.premium': 'Premium',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Mevcut AlixWork tasarımı',
    'experience.premiumDesc': 'Glassmorphism · premium kartlar',
    'experience.megaDesc': '3D · kontrol merkezi · flagship',
    'experience.download': 'Premium arka planı indir',
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
    'theme.toggle': 'تبديل السمة',
    'design.premiumDesign': 'تصميم فاخر',
    'design.downloadBackground': 'تنزيل الخلفية',
    'design.switchView': 'تبديل العرض',
    'experience.title': 'وضع التجربة',
    'experience.classic': 'كلاسيكي',
    'experience.premium': 'بريميوم',
    'experience.mega': 'ميجا',
    'experience.classicDesc': 'تصميم AlixWork الحالي',
    'experience.premiumDesc': 'زجاجي · بطاقات فاخرة',
    'experience.megaDesc': 'ثلاثي الأبعاد · مركز التحكم · رائد',
    'experience.download': 'تنزيل الخلفية الفاخرة',
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
    'theme.toggle': 'Đổi giao diện',
    'design.premiumDesign': 'Thiết kế cao cấp',
    'design.downloadBackground': 'Tải hình nền',
    'design.switchView': 'Đổi chế độ xem',
    'experience.title': 'Chế độ trải nghiệm',
    'experience.classic': 'Cổ điển',
    'experience.premium': 'Cao cấp',
    'experience.mega': 'Mega',
    'experience.classicDesc': 'Thiết kế AlixWork hiện tại',
    'experience.premiumDesc': 'Glassmorphism · thẻ cao cấp',
    'experience.megaDesc': '3D · trung tâm điều khiển · flagship',
    'experience.download': 'Tải hình nền cao cấp',
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
