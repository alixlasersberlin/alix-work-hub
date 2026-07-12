// Übersetzungen für den öffentlichen Buchungs-Wizard (/book).
// Nur UI-Labels des Wizards; dynamische Inhalte (Abteilungen, Terminarten aus der
// DB, Ansprechpartner-Namen) werden in ihrer gepflegten Sprache belassen.
import { useMemo } from 'react';
import { useWizardLang, type Lang } from '@/i18n/wizard';
import { de as deLocale, enUS, ru as ruLocale, arSA, fr as frLocale, it as itLocale, es as esLocale, nl as nlLocale, vi as viLocale } from 'date-fns/locale';

export type BookingDict = {
  dir: 'ltr' | 'rtl';
  dateLocale: Locale;
  step: { department: string; service: string; location: string; time: string; contact: string; summary: string };
  brand_line: string;
  step_of: (a: number, b: number) => string;
  cards: {
    offer_title: string; offer_badge: string; offer_desc: string; offer_create: string; offer_more: string;
    inquiry_title: string; inquiry_desc: string; no_public: string;
    orderstatus_title: string; orderstatus_desc: string;
    medipaket_title: string; medipaket_desc: string;
    nisv_title: string; nisv_badge: string; nisv_desc: string;
    anamnese_title: string; anamnese_desc: string;
  };
  service: { title: string; for: string; fallback: string[] };
  location: { title: string };
  time: {
    title: string; subtitle: string;
    none: string; waitlist_btn: string;
    waitlist_title: string; waitlist_hint: string; email_ph: string; waitlist_add: string; waitlist_added: string;
  };
  contact: {
    title: string;
    first_name: string; last_name: string; company: string; website: string; email: string; phone: string;
    contact_person: string; any: string; message: string;
    consent_privacy_pre: string; consent_privacy_link: string; consent_privacy_post: string;
    consent_email: string; consent_marketing: string;
    captcha: string;
  };
  summary: {
    title: string; subtitle: string;
    service_label: string; kind_label: string; location_label: string; date_label: string; time_label: string; contact_person_label: string;
    contact_label: string; company_label: string; email_label: string; phone_label: string;
    min_short: string;
  };
  nav: { back: string; next: string; submit: string };
  footer_badge: string;
  errors: { max_per_day: string };
  thanks: { title: string; text: string; number_label: string; again: string };
  duration_min: string;
};

const de: BookingDict = {
  dir: 'ltr', dateLocale: deLocale,
  step: { department: 'Leistung', service: 'Terminart', location: 'Standort', time: 'Zeit', contact: 'Kontakt', summary: 'Übersicht' },
  brand_line: 'Alix Smart – dein interaktives Lasersystem',
  step_of: (a, b) => `Schritt ${a} von ${b}`,
  cards: {
    offer_title: 'Mein persönliches Angebot', offer_badge: 'Angebot',
    offer_desc: 'Unterschrift, Angebot, Finanzierung, Kataloge, Setpreise, Vermietung – individuell für Sie.',
    offer_create: 'Mein persönliches Angebot erstellen lassen', offer_more: 'Zur Verkaufsberatung',
    inquiry_title: 'Anfragen und Rückruf schnell erledigt', inquiry_desc: 'Wählen Sie eine Leistung – Sie erhalten direkt eine Bestätigung per E-Mail.',
    no_public: 'Aktuell sind keine Leistungen öffentlich buchbar.',
    orderstatus_title: 'Mein Bestellstatus abfragen', orderstatus_desc: 'Sie haben bereits bestellt? Prüfen Sie den aktuellen Bearbeitungsstand Ihrer Bestellung mit Auftragsnummer, PLZ und E-Mail.',
    medipaket_title: 'Mein Medi Paket beantragen', medipaket_desc: 'Übermitteln Sie uns alle Informationen, Dateien und Wünsche für Ihre Webseite, Flyer und Social-Media-Vorlagen.',
    nisv_title: 'Anmeldung und Registrierung nach NISV', nisv_badge: 'PFLICHT!', nisv_desc: 'Die virtuelle Verwaltung Ihres Alix Gerätes: amtliche Dokumente, Tickets, Anleitungen und Ratgeber.',
    anamnese_title: 'Alix Smart – Anamnese Online – Termine, alles auf Ihren Laser', anamnese_desc: 'Alle Daten aus Ihrem Laser, Anamnese Online, Reservierungen, Kundendaten, Termine und viele Tools mehr – Alix Interaktiv.',
  },
  service: { title: 'Terminart wählen', for: 'Für', fallback: ['Beratung', 'Online Demo', 'Vorführung', 'Geräteeinweisung', 'Produktschulung'] },
  location: { title: 'Standort auswählen' },
  time: {
    title: 'Freien Termin wählen', subtitle: 'Nur tatsächlich verfügbare Zeiten werden angezeigt.',
    none: 'Für den gewählten Tag sind keine Zeiten verfügbar.', waitlist_btn: 'Auf Warteliste setzen',
    waitlist_title: 'Warteliste', waitlist_hint: 'Wir informieren Sie per E-Mail, sobald ein passender Termin frei wird.',
    email_ph: 'Ihre E-Mail', waitlist_add: 'Eintragen', waitlist_added: 'Auf Warteliste gesetzt.',
  },
  contact: {
    title: 'Ihre Kontaktdaten', first_name: 'Vorname', last_name: 'Nachname', company: 'Firma', website: 'Webseite', email: 'E-Mail', phone: 'Telefon',
    contact_person: 'Gewünschter Ansprechpartner (optional)', any: 'Egal', message: 'Nachricht',
    consent_privacy_pre: 'Ich habe die', consent_privacy_link: 'Datenschutzerklärung', consent_privacy_post: 'gelesen und akzeptiere sie.',
    consent_email: 'Ich willige in den Empfang von E-Mails zu diesem Termin ein.',
    consent_marketing: 'Optional: Ich möchte weitere Angebote per E-Mail erhalten.',
    captcha: 'Geschützt vor Spam · CAPTCHA (Cloudflare Turnstile) wird aktiviert.',
  },
  summary: {
    title: 'Zusammenfassung', subtitle: 'Bitte prüfen Sie Ihre Angaben.',
    service_label: 'Leistung', kind_label: 'Terminart', location_label: 'Standort', date_label: 'Datum', time_label: 'Uhrzeit', contact_person_label: 'Ansprechpartner',
    contact_label: 'Kontakt', company_label: 'Firma', email_label: 'E-Mail', phone_label: 'Telefon', min_short: 'min',
  },
  nav: { back: 'Zurück', next: 'Weiter', submit: 'Buchung absenden' },
  footer_badge: 'alixworks.de · Sichere Verbindung',
  errors: { max_per_day: 'Maximale Buchungen für diesen Tag erreicht.' },
  thanks: { title: 'Vielen Dank!', text: 'Ihre Buchungsanfrage ist bei uns eingegangen. Sie erhalten in Kürze eine Bestätigungs-E-Mail.', number_label: 'Buchungsnummer', again: 'Weitere Buchung' },
  duration_min: 'min',
};

const en: BookingDict = {
  dir: 'ltr', dateLocale: enUS,
  step: { department: 'Service', service: 'Type', location: 'Location', time: 'Time', contact: 'Contact', summary: 'Summary' },
  brand_line: 'Alix Smart – your interactive laser system',
  step_of: (a, b) => `Step ${a} of ${b}`,
  cards: {
    offer_title: 'My personal quote', offer_badge: 'Quote',
    offer_desc: 'Signature, quote, financing, catalogues, set prices, rental – tailored for you.',
    offer_create: 'Request my personal quote', offer_more: 'Go to sales consulting',
    inquiry_title: 'Requests & callbacks – quickly handled', inquiry_desc: 'Pick a service – you will receive an immediate confirmation e-mail.',
    no_public: 'No services are currently open for public booking.',
    orderstatus_title: 'Check my order status', orderstatus_desc: 'Already ordered? Check the current processing status of your order using order number, ZIP code and e-mail.',
    medipaket_title: 'Request my Medi Package', medipaket_desc: 'Send us all information, files and wishes for your website, flyers and social-media templates.',
    nisv_title: 'Registration under NISV', nisv_badge: 'MANDATORY!', nisv_desc: 'Virtual management of your Alix device: official documents, tickets, guides and advice.',
    anamnese_title: 'Alix Smart – Online anamnesis & appointments, all on your laser', anamnese_desc: 'All data from your laser, online anamnesis, reservations, customer data, appointments and many more tools – Alix Interactive.',
  },
  service: { title: 'Choose appointment type', for: 'For', fallback: ['Consulting', 'Online demo', 'Presentation', 'Device instruction', 'Product training'] },
  location: { title: 'Choose a location' },
  time: {
    title: 'Choose a free slot', subtitle: 'Only actually available times are shown.',
    none: 'No times are available on the selected day.', waitlist_btn: 'Add to waitlist',
    waitlist_title: 'Waitlist', waitlist_hint: 'We will notify you by e-mail as soon as a suitable slot becomes available.',
    email_ph: 'Your e-mail', waitlist_add: 'Add', waitlist_added: 'Added to the waitlist.',
  },
  contact: {
    title: 'Your contact details', first_name: 'First name', last_name: 'Last name', company: 'Company', website: 'Website', email: 'E-mail', phone: 'Phone',
    contact_person: 'Preferred contact person (optional)', any: 'Any', message: 'Message',
    consent_privacy_pre: 'I have read and accept the', consent_privacy_link: 'privacy policy', consent_privacy_post: '.',
    consent_email: 'I consent to receive e-mails about this appointment.',
    consent_marketing: 'Optional: I would like to receive further offers by e-mail.',
    captcha: 'Spam-protected · CAPTCHA (Cloudflare Turnstile) will be activated.',
  },
  summary: {
    title: 'Summary', subtitle: 'Please review your entries.',
    service_label: 'Service', kind_label: 'Type', location_label: 'Location', date_label: 'Date', time_label: 'Time', contact_person_label: 'Contact person',
    contact_label: 'Contact', company_label: 'Company', email_label: 'E-mail', phone_label: 'Phone', min_short: 'min',
  },
  nav: { back: 'Back', next: 'Next', submit: 'Submit booking' },
  footer_badge: 'alixworks.de · Secure connection',
  errors: { max_per_day: 'Maximum bookings for this day reached.' },
  thanks: { title: 'Thank you!', text: 'We have received your booking request. You will receive a confirmation e-mail shortly.', number_label: 'Booking number', again: 'New booking' },
  duration_min: 'min',
};

const ru: BookingDict = {
  dir: 'ltr', dateLocale: ruLocale,
  step: { department: 'Услуга', service: 'Тип записи', location: 'Локация', time: 'Время', contact: 'Контакт', summary: 'Обзор' },
  brand_line: 'Alix Smart – ваша интерактивная лазерная система',
  step_of: (a, b) => `Шаг ${a} из ${b}`,
  cards: {
    offer_title: 'Моё персональное предложение', offer_badge: 'Оффер',
    offer_desc: 'Подпись, предложение, финансирование, каталоги, комплекты, аренда – индивидуально для вас.',
    offer_create: 'Заказать персональное предложение', offer_more: 'К консультации по продажам',
    inquiry_title: 'Запрос и обратный звонок – быстро', inquiry_desc: 'Выберите услугу – вы сразу получите подтверждение по e-mail.',
    no_public: 'В данный момент нет услуг, доступных для публичной записи.',
    orderstatus_title: 'Проверить статус заказа', orderstatus_desc: 'Уже заказывали? Проверьте текущий статус вашего заказа по номеру, индексу и e-mail.',
    medipaket_title: 'Заказать мой Medi-пакет', medipaket_desc: 'Пришлите нам всю информацию, файлы и пожелания для вашего сайта, флаеров и шаблонов соцсетей.',
    nisv_title: 'Регистрация по NISV', nisv_badge: 'ОБЯЗАТЕЛЬНО!', nisv_desc: 'Виртуальное управление вашим устройством Alix: официальные документы, тикеты, инструкции и советы.',
    anamnese_title: 'Alix Smart – онлайн-анамнез и записи, всё на вашем лазере', anamnese_desc: 'Все данные с вашего лазера, онлайн-анамнез, брони, клиентские данные, записи и множество инструментов – Alix Interactive.',
  },
  service: { title: 'Выберите тип записи', for: 'Для', fallback: ['Консультация', 'Онлайн-демо', 'Презентация', 'Инструктаж по устройству', 'Обучение по продукту'] },
  location: { title: 'Выберите локацию' },
  time: {
    title: 'Выберите свободное время', subtitle: 'Показываются только реально доступные слоты.',
    none: 'На выбранный день нет свободного времени.', waitlist_btn: 'В список ожидания',
    waitlist_title: 'Список ожидания', waitlist_hint: 'Мы сообщим по e-mail, как только освободится подходящее время.',
    email_ph: 'Ваш e-mail', waitlist_add: 'Добавить', waitlist_added: 'Добавлено в список ожидания.',
  },
  contact: {
    title: 'Ваши контактные данные', first_name: 'Имя', last_name: 'Фамилия', company: 'Компания', website: 'Сайт', email: 'E-mail', phone: 'Телефон',
    contact_person: 'Желаемый ответственный (необязательно)', any: 'Не важно', message: 'Сообщение',
    consent_privacy_pre: 'Я прочитал(а) и принимаю', consent_privacy_link: 'политику конфиденциальности', consent_privacy_post: '.',
    consent_email: 'Я согласен(на) получать e-mail по этой записи.',
    consent_marketing: 'Опционально: хочу получать дальнейшие предложения по e-mail.',
    captcha: 'Защита от спама · CAPTCHA (Cloudflare Turnstile) будет активирована.',
  },
  summary: {
    title: 'Обзор', subtitle: 'Пожалуйста, проверьте введённые данные.',
    service_label: 'Услуга', kind_label: 'Тип записи', location_label: 'Локация', date_label: 'Дата', time_label: 'Время', contact_person_label: 'Ответственный',
    contact_label: 'Контакт', company_label: 'Компания', email_label: 'E-mail', phone_label: 'Телефон', min_short: 'мин',
  },
  nav: { back: 'Назад', next: 'Далее', submit: 'Отправить заявку' },
  footer_badge: 'alixworks.de · Безопасное соединение',
  errors: { max_per_day: 'Достигнут лимит записей на этот день.' },
  thanks: { title: 'Спасибо!', text: 'Ваш запрос получен. В ближайшее время придёт письмо с подтверждением.', number_label: 'Номер записи', again: 'Новая запись' },
  duration_min: 'мин',
};

const ar: BookingDict = {
  dir: 'rtl', dateLocale: arSA,
  step: { department: 'الخدمة', service: 'نوع الموعد', location: 'الموقع', time: 'الوقت', contact: 'جهة الاتصال', summary: 'الملخص' },
  brand_line: 'Alix Smart – نظام الليزر التفاعلي الخاص بك',
  step_of: (a, b) => `الخطوة ${a} من ${b}`,
  cards: {
    offer_title: 'عرضي الشخصي', offer_badge: 'عرض',
    offer_desc: 'توقيع، عرض، تمويل، كتالوجات، أسعار مجموعات، تأجير – مخصص لك.',
    offer_create: 'اطلب عرضي الشخصي', offer_more: 'إلى الاستشارة البيعية',
    inquiry_title: 'الطلبات ومعاودة الاتصال – بسرعة', inquiry_desc: 'اختر خدمة – ستصلك رسالة تأكيد فورًا بالبريد الإلكتروني.',
    no_public: 'لا تتوفر حاليًا أي خدمات للحجز العام.',
    orderstatus_title: 'الاستعلام عن حالة طلبي', orderstatus_desc: 'هل طلبت من قبل؟ تحقق من حالة طلبك الحالية عبر رقم الطلب والرمز البريدي والبريد الإلكتروني.',
    medipaket_title: 'طلب حزمة Medi', medipaket_desc: 'أرسل لنا كل المعلومات والملفات والرغبات لموقعك ومنشوراتك وقوالب وسائل التواصل.',
    nisv_title: 'التسجيل وفق NISV', nisv_badge: 'إلزامي!', nisv_desc: 'الإدارة الافتراضية لجهاز Alix الخاص بك: المستندات الرسمية والتذاكر والأدلة والنصائح.',
    anamnese_title: 'Alix Smart – سجل طبي أونلاين ومواعيد على جهاز الليزر الخاص بك', anamnese_desc: 'كل بيانات جهاز الليزر، السجل الطبي الإلكتروني، الحجوزات، بيانات العملاء، المواعيد وأدوات إضافية – Alix Interactive.',
  },
  service: { title: 'اختر نوع الموعد', for: 'من أجل', fallback: ['استشارة', 'عرض أونلاين', 'عرض توضيحي', 'تدريب على الجهاز', 'تدريب على المنتج'] },
  location: { title: 'اختر الموقع' },
  time: {
    title: 'اختر موعدًا متاحًا', subtitle: 'تُعرض فقط الأوقات المتاحة فعلًا.',
    none: 'لا توجد أوقات متاحة في اليوم المحدد.', waitlist_btn: 'أضِفني إلى قائمة الانتظار',
    waitlist_title: 'قائمة الانتظار', waitlist_hint: 'سنبلغك عبر البريد الإلكتروني بمجرد توفر موعد مناسب.',
    email_ph: 'بريدك الإلكتروني', waitlist_add: 'إضافة', waitlist_added: 'تمت الإضافة إلى قائمة الانتظار.',
  },
  contact: {
    title: 'بيانات الاتصال الخاصة بك', first_name: 'الاسم الأول', last_name: 'اسم العائلة', company: 'الشركة', website: 'الموقع', email: 'البريد الإلكتروني', phone: 'الهاتف',
    contact_person: 'الشخص المسؤول المُفضل (اختياري)', any: 'لا يهم', message: 'رسالة',
    consent_privacy_pre: 'لقد قرأت وأوافق على', consent_privacy_link: 'سياسة الخصوصية', consent_privacy_post: '.',
    consent_email: 'أوافق على استلام رسائل بريد إلكتروني حول هذا الموعد.',
    consent_marketing: 'اختياري: أرغب في استلام عروض إضافية عبر البريد الإلكتروني.',
    captcha: 'محمي من الرسائل المزعجة · سيتم تفعيل CAPTCHA (Cloudflare Turnstile).',
  },
  summary: {
    title: 'الملخص', subtitle: 'يرجى مراجعة البيانات.',
    service_label: 'الخدمة', kind_label: 'نوع الموعد', location_label: 'الموقع', date_label: 'التاريخ', time_label: 'الوقت', contact_person_label: 'الشخص المسؤول',
    contact_label: 'جهة الاتصال', company_label: 'الشركة', email_label: 'البريد الإلكتروني', phone_label: 'الهاتف', min_short: 'د',
  },
  nav: { back: 'رجوع', next: 'التالي', submit: 'إرسال الحجز' },
  footer_badge: 'alixworks.de · اتصال آمن',
  errors: { max_per_day: 'تم بلوغ الحد الأقصى للحجوزات في هذا اليوم.' },
  thanks: { title: 'شكرًا لك!', text: 'تم استلام طلب الحجز. ستصلك رسالة تأكيد قريبًا عبر البريد الإلكتروني.', number_label: 'رقم الحجز', again: 'حجز جديد' },
  duration_min: 'د',
};

// Für nicht separat gepflegte Sprachen fallen wir auf Englisch zurück.
const DICTS: Record<Lang, BookingDict> = {
  de, en, ru, ar,
  fr: { ...en, dateLocale: frLocale },
  it: { ...en, dateLocale: itLocale },
  es: { ...en, dateLocale: esLocale },
  nl: { ...en, dateLocale: nlLocale },
  vi: { ...en, dateLocale: viLocale },
};

export function useBookingT() {
  const { lang } = useWizardLang();
  return useMemo(() => ({ t: DICTS[lang] ?? de, lang }), [lang]);
}
