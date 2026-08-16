import { useCallback, useEffect, useState } from 'react';

/**
 * Sprachen der ALIX Premium Beratung (/beratung/premium).
 * Die im Backend gespeicherten Werte bleiben immer deutsch (kanonisch) —
 * übersetzt wird ausschliesslich die Anzeige.
 */
export type PLang = 'de' | 'en' | 'es' | 'ru';

export const P_LANGS: { code: PLang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const STORAGE_KEY = 'alix.premium.lang';

export type PDict = {
  brand: string;
  intro_kicker: string;
  intro_title: string;
  intro_lead: string;
  intro_cta: string;
  steps: [string, string, string, string];
  step_of: (a: number, b: number) => string;
  progress_aria: string;
  back: string;
  next: string;
  send: string;

  c1_title: string;
  c1_sub: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  email_ph: string;
  phone: string;
  phone_ph: string;
  country_code_aria: string;
  code_other: string;
  code_custom_aria: string;
  group_europe: string;
  group_world: string;
  hint_custom_code: string;
  hint_no_leading_zero: string;

  c2_title: string;
  c2_sub: string;

  c3_title: string;
  c3_sub: (cat: string) => string;
  g_delivery: string;
  g_delivery_err: string;
  g_consultation: string;
  g_consultation_err: string;
  g_additional: string;
  g_notes: string;

  c4_title: string;
  c4_sub: string;
  consent_data: string;
  consent_contact: string;
  consent_required: string;
  captcha_required: string;

  done_title: string;
  done_text: string;
  done_hint: string;

  analyzing: string;

  // Validierung
  v_required: (label: string) => string;
  v_min2: (label: string) => string;
  v_max100: (label: string) => string;
  v_no_digits: (label: string) => string;
  v_company_max: string;
  v_email_required: string;
  v_email_long: string;
  v_email_invalid: string;
  v_phone_required: string;
  v_phone_invalid: string;
  v_phone_short: (min: number, country: string) => string;
  v_phone_long: (max: number, country: string) => string;
  v_code_required: string;
  v_code_format: string;
  v_notes_long: (len: number) => string;
  err_submit: string;
  err_unknown: string;

  // Werte-Übersetzungen (Schlüssel = kanonische deutsche Werte)
  categories: Record<string, string>;
  category_desc: Record<string, string>;
  delivery: Record<string, string>;
  consultation: Record<string, string>;
  additional: Record<string, string>;
};

const de: PDict = {
  brand: 'Alix Smart Consult',
  intro_kicker: 'Premium Consult',
  intro_title: 'IHRE ALIX BERATUNG',
  intro_lead:
    'In wenigen Schritten zu den passenden ALIX Systemen — persönlich, unverbindlich und direkt von einem ALIX Berater begleitet.',
  intro_cta: 'Beratung starten',
  steps: ['PROFIL', 'ANWENDUNG', 'BEDARF', 'ABSCHLUSS'],
  step_of: (a, b) => `Schritt ${a} von ${b}`,
  progress_aria: 'Fortschritt der Beratung',
  back: 'Zurück',
  next: 'Weiter',
  send: 'Beratung absenden',

  c1_title: 'IHRE KONTAKTDATEN',
  c1_sub: 'Damit ein ALIX Berater Sie erreichen kann.',
  first_name: 'Vorname',
  last_name: 'Nachname *',
  company: 'Unternehmen (optional)',
  email: 'E-Mail *',
  email_ph: 'name@praxis.de',
  phone: 'Telefon *',
  phone_ph: '171 1651000',
  country_code_aria: 'Ländervorwahl',
  code_other: '➕ Andere…',
  code_custom_aria: 'Vorwahl frei eingeben',
  group_europe: 'Europa',
  group_world: 'Weltweit',
  hint_custom_code: 'Freie Ländervorwahl — ohne führende 0',
  hint_no_leading_zero: 'ohne führende 0',

  c2_title: 'WAS MÖCHTEN SIE BEHANDELN?',
  c2_sub: 'Wählen Sie Ihren Schwerpunkt – wir führen Sie anschliessend zu den passenden ALIX Systemen.',

  c3_title: 'IHR BEDARF',
  c3_sub: (cat) => `Schwerpunkt: ${cat}`,
  g_delivery: 'Gewünschter Lieferzeitraum (Mehrfachauswahl) *',
  g_delivery_err: 'Bitte mindestens einen Lieferzeitraum wählen.',
  g_consultation: 'Beratungsart (Mehrfachauswahl) *',
  g_consultation_err: 'Bitte mindestens eine Beratungsart wählen.',
  g_additional: 'Weitere Interessen (optional)',
  g_notes: 'Ihre Nachricht (optional)',

  c4_title: 'ABSCHLUSS',
  c4_sub: 'Bitte bestätigen Sie die Datenschutzhinweise.',
  consent_data: 'Ich stimme der Verarbeitung meiner Daten zur Bearbeitung meiner Anfrage zu.',
  consent_contact: 'Ich bin mit einer Kontaktaufnahme per Telefon, E-Mail oder WhatsApp einverstanden.',
  consent_required: 'Diese Einwilligung ist erforderlich.',
  captcha_required: 'Bitte bestätigen Sie die Sicherheitsprüfung.',

  done_title: 'VIELEN DANK.',
  done_text: 'Ihre ALIX Beratung wurde erfolgreich übermittelt.',
  done_hint: 'Ein ALIX Berater kann nun Ihre Auswahl und Anforderungen einsehen.',

  analyzing: 'Analyse Ihrer Auswahl',

  v_required: (l) => `${l} ist ein Pflichtfeld.`,
  v_min2: (l) => `${l} muss mindestens 2 Zeichen haben.`,
  v_max100: (l) => `${l} darf max. 100 Zeichen haben.`,
  v_no_digits: (l) => `${l} darf keine Ziffern enthalten.`,
  v_company_max: 'Unternehmen darf max. 150 Zeichen haben.',
  v_email_required: 'E-Mail ist ein Pflichtfeld.',
  v_email_long: 'E-Mail ist zu lang.',
  v_email_invalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  v_phone_required: 'Telefonnummer ist ein Pflichtfeld.',
  v_phone_invalid: 'Bitte geben Sie eine gültige Telefonnummer ein.',
  v_phone_short: (min, c) => `Die Nummer ist zu kurz (mind. ${min} Ziffern für ${c}).`,
  v_phone_long: (max, c) => `Die Nummer ist zu lang (max. ${max} Ziffern für ${c}).`,
  v_code_required: 'Bitte Ländervorwahl angeben.',
  v_code_format: 'Vorwahl im Format +49 angeben.',
  v_notes_long: (len) => `Nachricht ist zu lang (${len}/2000 Zeichen).`,
  err_submit: 'Fehler beim Absenden',
  err_unknown: 'Unbekannter Fehler',

  categories: {
    'Haarentfernung': 'Haarentfernung',
    'Haut & Anti Aging': 'Haut & Anti Aging',
    'Körper & Abnehmen': 'Körper & Abnehmen',
    'Tattoo & Pigment': 'Tattoo & Pigment',
  },
  category_desc: {
    'Haarentfernung': 'Dauerhafte Haarreduktion mit Dioden- und SHR-Technologie.',
    'Haut & Anti Aging': 'Hautbild, Straffung und Regeneration auf medizinischem Niveau.',
    'Körper & Abnehmen': 'Körperformung, Fettreduktion und Straffung.',
    'Tattoo & Pigment': 'Tattoo-Entfernung und Pigmentkorrektur.',
  },
  delivery: {
    'schnellstmöglich': 'schnellstmöglich',
    '2–4 Wochen': '2–4 Wochen',
    '4–8 Wochen': '4–8 Wochen',
    'mehr als 8 Wochen': 'mehr als 8 Wochen',
  },
  consultation: {
    'Telefonische Beratung': 'Telefonische Beratung',
    'WhatsApp Beratung': 'WhatsApp Beratung',
    'Studio Beratung': 'Studio Beratung',
    'Alix Showroom': 'Alix Showroom',
    'Videoberatung': 'Videoberatung',
  },
  additional: {
    'NiSV Ausbildung': 'NiSV Ausbildung',
    'Laserschulung': 'Laserschulung',
    'Finanzierungsmöglichkeiten': 'Finanzierungsmöglichkeiten',
    'Mietkauf / Miete / Smart Impulse': 'Mietkauf / Miete / Smart Impulse',
    'Katalog anfordern': 'Katalog anfordern',
  },
};

const en: PDict = {
  ...de,
  brand: 'Alix Smart Consult',
  intro_kicker: 'Premium Consult',
  intro_title: 'YOUR ALIX CONSULTATION',
  intro_lead:
    'Just a few steps to the right ALIX systems — personal, non-binding and guided by an ALIX consultant.',
  intro_cta: 'Start consultation',
  steps: ['PROFILE', 'APPLICATION', 'NEEDS', 'FINISH'],
  step_of: (a, b) => `Step ${a} of ${b}`,
  progress_aria: 'Consultation progress',
  back: 'Back',
  next: 'Next',
  send: 'Send request',

  c1_title: 'YOUR CONTACT DETAILS',
  c1_sub: 'So an ALIX consultant can reach you.',
  first_name: 'First name',
  last_name: 'Last name *',
  company: 'Company (optional)',
  email: 'Email *',
  email_ph: 'name@company.com',
  phone: 'Phone *',
  phone_ph: '171 1651000',
  country_code_aria: 'Country code',
  code_other: '➕ Other…',
  code_custom_aria: 'Enter country code manually',
  group_europe: 'Europe',
  group_world: 'Worldwide',
  hint_custom_code: 'Custom country code — without leading 0',
  hint_no_leading_zero: 'without leading 0',

  c2_title: 'WHAT WOULD YOU LIKE TO TREAT?',
  c2_sub: 'Choose your focus – we will then guide you to the matching ALIX systems.',

  c3_title: 'YOUR REQUIREMENTS',
  c3_sub: (cat) => `Focus: ${cat}`,
  g_delivery: 'Preferred delivery period (multiple choice) *',
  g_delivery_err: 'Please select at least one delivery period.',
  g_consultation: 'Type of consultation (multiple choice) *',
  g_consultation_err: 'Please select at least one consultation type.',
  g_additional: 'Additional interests (optional)',
  g_notes: 'Your message (optional)',

  c4_title: 'FINISH',
  c4_sub: 'Please confirm the privacy notices.',
  consent_data: 'I agree to the processing of my data to handle my request.',
  consent_contact: 'I agree to be contacted by phone, email or WhatsApp.',
  consent_required: 'This consent is required.',
  captcha_required: 'Please complete the security check.',

  done_title: 'THANK YOU.',
  done_text: 'Your ALIX consultation request has been submitted successfully.',
  done_hint: 'An ALIX consultant can now review your selection and requirements.',

  analyzing: 'Analyzing your selection',

  v_required: (l) => `${l} is required.`,
  v_min2: (l) => `${l} must have at least 2 characters.`,
  v_max100: (l) => `${l} may have max. 100 characters.`,
  v_no_digits: (l) => `${l} must not contain digits.`,
  v_company_max: 'Company may have max. 150 characters.',
  v_email_required: 'Email is required.',
  v_email_long: 'Email is too long.',
  v_email_invalid: 'Please enter a valid email address.',
  v_phone_required: 'Phone number is required.',
  v_phone_invalid: 'Please enter a valid phone number.',
  v_phone_short: (min, c) => `The number is too short (min. ${min} digits for ${c}).`,
  v_phone_long: (max, c) => `The number is too long (max. ${max} digits for ${c}).`,
  v_code_required: 'Please provide a country code.',
  v_code_format: 'Use the format +49.',
  v_notes_long: (len) => `Message is too long (${len}/2000 characters).`,
  err_submit: 'Error while sending',
  err_unknown: 'Unknown error',

  categories: {
    'Haarentfernung': 'Hair removal',
    'Haut & Anti Aging': 'Skin & anti aging',
    'Körper & Abnehmen': 'Body & weight loss',
    'Tattoo & Pigment': 'Tattoo & pigment',
  },
  category_desc: {
    'Haarentfernung': 'Permanent hair reduction with diode and SHR technology.',
    'Haut & Anti Aging': 'Skin quality, tightening and regeneration at medical level.',
    'Körper & Abnehmen': 'Body contouring, fat reduction and tightening.',
    'Tattoo & Pigment': 'Tattoo removal and pigment correction.',
  },
  delivery: {
    'schnellstmöglich': 'as soon as possible',
    '2–4 Wochen': '2–4 weeks',
    '4–8 Wochen': '4–8 weeks',
    'mehr als 8 Wochen': 'more than 8 weeks',
  },
  consultation: {
    'Telefonische Beratung': 'Phone consultation',
    'WhatsApp Beratung': 'WhatsApp consultation',
    'Studio Beratung': 'Studio consultation',
    'Alix Showroom': 'Alix showroom',
    'Videoberatung': 'Video consultation',
  },
  additional: {
    'NiSV Ausbildung': 'NiSV training',
    'Laserschulung': 'Laser training',
    'Finanzierungsmöglichkeiten': 'Financing options',
    'Mietkauf / Miete / Smart Impulse': 'Lease-to-own / rental / Smart Impulse',
    'Katalog anfordern': 'Request catalogue',
  },
};

const es: PDict = {
  ...de,
  intro_kicker: 'Consulta Premium',
  intro_title: 'SU ASESORÍA ALIX',
  intro_lead:
    'En pocos pasos hacia los sistemas ALIX adecuados: personal, sin compromiso y acompañado por un asesor ALIX.',
  intro_cta: 'Iniciar asesoría',
  steps: ['PERFIL', 'APLICACIÓN', 'NECESIDAD', 'FINALIZAR'],
  step_of: (a, b) => `Paso ${a} de ${b}`,
  progress_aria: 'Progreso de la asesoría',
  back: 'Atrás',
  next: 'Siguiente',
  send: 'Enviar solicitud',

  c1_title: 'SUS DATOS DE CONTACTO',
  c1_sub: 'Para que un asesor ALIX pueda contactarle.',
  first_name: 'Nombre',
  last_name: 'Apellido *',
  company: 'Empresa (opcional)',
  email: 'Correo electrónico *',
  email_ph: 'nombre@empresa.es',
  phone: 'Teléfono *',
  phone_ph: '171 1651000',
  country_code_aria: 'Prefijo del país',
  code_other: '➕ Otro…',
  code_custom_aria: 'Introducir prefijo manualmente',
  group_europe: 'Europa',
  group_world: 'Mundial',
  hint_custom_code: 'Prefijo libre — sin el 0 inicial',
  hint_no_leading_zero: 'sin el 0 inicial',

  c2_title: '¿QUÉ DESEA TRATAR?',
  c2_sub: 'Elija su área principal: le guiaremos a los sistemas ALIX adecuados.',

  c3_title: 'SU NECESIDAD',
  c3_sub: (cat) => `Área principal: ${cat}`,
  g_delivery: 'Plazo de entrega deseado (selección múltiple) *',
  g_delivery_err: 'Seleccione al menos un plazo de entrega.',
  g_consultation: 'Tipo de asesoría (selección múltiple) *',
  g_consultation_err: 'Seleccione al menos un tipo de asesoría.',
  g_additional: 'Intereses adicionales (opcional)',
  g_notes: 'Su mensaje (opcional)',

  c4_title: 'FINALIZAR',
  c4_sub: 'Confirme los avisos de protección de datos.',
  consent_data: 'Acepto el tratamiento de mis datos para gestionar mi solicitud.',
  consent_contact: 'Acepto ser contactado por teléfono, correo electrónico o WhatsApp.',
  consent_required: 'Este consentimiento es obligatorio.',
  captcha_required: 'Complete la verificación de seguridad.',

  done_title: '¡MUCHAS GRACIAS!',
  done_text: 'Su solicitud de asesoría ALIX se ha enviado correctamente.',
  done_hint: 'Un asesor ALIX ya puede ver su selección y sus requisitos.',

  analyzing: 'Analizando su selección',

  v_required: (l) => `${l} es un campo obligatorio.`,
  v_min2: (l) => `${l} debe tener al menos 2 caracteres.`,
  v_max100: (l) => `${l} puede tener máx. 100 caracteres.`,
  v_no_digits: (l) => `${l} no puede contener cifras.`,
  v_company_max: 'La empresa puede tener máx. 150 caracteres.',
  v_email_required: 'El correo electrónico es obligatorio.',
  v_email_long: 'El correo electrónico es demasiado largo.',
  v_email_invalid: 'Introduzca una dirección de correo válida.',
  v_phone_required: 'El teléfono es obligatorio.',
  v_phone_invalid: 'Introduzca un número de teléfono válido.',
  v_phone_short: (min, c) => `El número es demasiado corto (mín. ${min} cifras para ${c}).`,
  v_phone_long: (max, c) => `El número es demasiado largo (máx. ${max} cifras para ${c}).`,
  v_code_required: 'Indique el prefijo del país.',
  v_code_format: 'Use el formato +49.',
  v_notes_long: (len) => `El mensaje es demasiado largo (${len}/2000 caracteres).`,
  err_submit: 'Error al enviar',
  err_unknown: 'Error desconocido',

  categories: {
    'Haarentfernung': 'Depilación',
    'Haut & Anti Aging': 'Piel y antiedad',
    'Körper & Abnehmen': 'Cuerpo y adelgazamiento',
    'Tattoo & Pigment': 'Tatuajes y pigmentos',
  },
  category_desc: {
    'Haarentfernung': 'Reducción permanente del vello con tecnología de diodo y SHR.',
    'Haut & Anti Aging': 'Calidad de la piel, reafirmación y regeneración a nivel médico.',
    'Körper & Abnehmen': 'Remodelación corporal, reducción de grasa y reafirmación.',
    'Tattoo & Pigment': 'Eliminación de tatuajes y corrección de pigmentos.',
  },
  delivery: {
    'schnellstmöglich': 'lo antes posible',
    '2–4 Wochen': '2–4 semanas',
    '4–8 Wochen': '4–8 semanas',
    'mehr als 8 Wochen': 'más de 8 semanas',
  },
  consultation: {
    'Telefonische Beratung': 'Asesoría telefónica',
    'WhatsApp Beratung': 'Asesoría por WhatsApp',
    'Studio Beratung': 'Asesoría en el estudio',
    'Alix Showroom': 'Showroom Alix',
    'Videoberatung': 'Asesoría por vídeo',
  },
  additional: {
    'NiSV Ausbildung': 'Formación NiSV',
    'Laserschulung': 'Formación en láser',
    'Finanzierungsmöglichkeiten': 'Opciones de financiación',
    'Mietkauf / Miete / Smart Impulse': 'Arrendamiento con opción a compra / alquiler / Smart Impulse',
    'Katalog anfordern': 'Solicitar catálogo',
  },
};

const ru: PDict = {
  ...de,
  intro_kicker: 'Премиум-консультация',
  intro_title: 'ВАША КОНСУЛЬТАЦИЯ ALIX',
  intro_lead:
    'Всего несколько шагов до подходящих систем ALIX — персонально, без обязательств и с поддержкой консультанта ALIX.',
  intro_cta: 'Начать консультацию',
  steps: ['ПРОФИЛЬ', 'ПРИМЕНЕНИЕ', 'ПОТРЕБНОСТИ', 'ЗАВЕРШЕНИЕ'],
  step_of: (a, b) => `Шаг ${a} из ${b}`,
  progress_aria: 'Ход консультации',
  back: 'Назад',
  next: 'Далее',
  send: 'Отправить запрос',

  c1_title: 'ВАШИ КОНТАКТНЫЕ ДАННЫЕ',
  c1_sub: 'Чтобы консультант ALIX мог с вами связаться.',
  first_name: 'Имя',
  last_name: 'Фамилия *',
  company: 'Компания (необязательно)',
  email: 'E-Mail *',
  email_ph: 'name@company.com',
  phone: 'Телефон *',
  phone_ph: '171 1651000',
  country_code_aria: 'Код страны',
  code_other: '➕ Другой…',
  code_custom_aria: 'Ввести код страны вручную',
  group_europe: 'Европа',
  group_world: 'Весь мир',
  hint_custom_code: 'Произвольный код страны — без ведущего 0',
  hint_no_leading_zero: 'без ведущего 0',

  c2_title: 'ЧТО ВЫ ХОТИТЕ ЛЕЧИТЬ?',
  c2_sub: 'Выберите основное направление — мы подберём подходящие системы ALIX.',

  c3_title: 'ВАШИ ПОТРЕБНОСТИ',
  c3_sub: (cat) => `Направление: ${cat}`,
  g_delivery: 'Желаемый срок поставки (несколько вариантов) *',
  g_delivery_err: 'Выберите хотя бы один срок поставки.',
  g_consultation: 'Формат консультации (несколько вариантов) *',
  g_consultation_err: 'Выберите хотя бы один формат консультации.',
  g_additional: 'Дополнительные интересы (необязательно)',
  g_notes: 'Ваше сообщение (необязательно)',

  c4_title: 'ЗАВЕРШЕНИЕ',
  c4_sub: 'Подтвердите условия обработки данных.',
  consent_data: 'Я согласен на обработку моих данных для рассмотрения запроса.',
  consent_contact: 'Я согласен на связь по телефону, e-mail или WhatsApp.',
  consent_required: 'Это согласие обязательно.',
  captcha_required: 'Пожалуйста, пройдите проверку безопасности.',

  done_title: 'БЛАГОДАРИМ ВАС.',
  done_text: 'Ваш запрос на консультацию ALIX успешно отправлен.',
  done_hint: 'Консультант ALIX уже может видеть ваш выбор и требования.',

  analyzing: 'Анализ вашего выбора',

  v_required: (l) => `Поле «${l}» обязательно.`,
  v_min2: (l) => `«${l}» должно содержать минимум 2 символа.`,
  v_max100: (l) => `«${l}» — максимум 100 символов.`,
  v_no_digits: (l) => `«${l}» не должно содержать цифр.`,
  v_company_max: 'Название компании — максимум 150 символов.',
  v_email_required: 'E-Mail обязателен.',
  v_email_long: 'E-Mail слишком длинный.',
  v_email_invalid: 'Введите корректный адрес e-mail.',
  v_phone_required: 'Номер телефона обязателен.',
  v_phone_invalid: 'Введите корректный номер телефона.',
  v_phone_short: (min, c) => `Номер слишком короткий (мин. ${min} цифр для ${c}).`,
  v_phone_long: (max, c) => `Номер слишком длинный (макс. ${max} цифр для ${c}).`,
  v_code_required: 'Укажите код страны.',
  v_code_format: 'Формат кода: +49.',
  v_notes_long: (len) => `Сообщение слишком длинное (${len}/2000 символов).`,
  err_submit: 'Ошибка при отправке',
  err_unknown: 'Неизвестная ошибка',

  categories: {
    'Haarentfernung': 'Удаление волос',
    'Haut & Anti Aging': 'Кожа и анти-эйдж',
    'Körper & Abnehmen': 'Тело и похудение',
    'Tattoo & Pigment': 'Тату и пигмент',
  },
  category_desc: {
    'Haarentfernung': 'Постоянное удаление волос по диодной и SHR-технологии.',
    'Haut & Anti Aging': 'Качество кожи, подтяжка и регенерация на медицинском уровне.',
    'Körper & Abnehmen': 'Коррекция фигуры, уменьшение жира и подтяжка.',
    'Tattoo & Pigment': 'Удаление татуировок и коррекция пигментации.',
  },
  delivery: {
    'schnellstmöglich': 'как можно скорее',
    '2–4 Wochen': '2–4 недели',
    '4–8 Wochen': '4–8 недель',
    'mehr als 8 Wochen': 'более 8 недель',
  },
  consultation: {
    'Telefonische Beratung': 'Консультация по телефону',
    'WhatsApp Beratung': 'Консультация в WhatsApp',
    'Studio Beratung': 'Консультация в студии',
    'Alix Showroom': 'Шоурум Alix',
    'Videoberatung': 'Видеоконсультация',
  },
  additional: {
    'NiSV Ausbildung': 'Обучение NiSV',
    'Laserschulung': 'Обучение работе с лазером',
    'Finanzierungsmöglichkeiten': 'Варианты финансирования',
    'Mietkauf / Miete / Smart Impulse': 'Лизинг / аренда / Smart Impulse',
    'Katalog anfordern': 'Запросить каталог',
  },
};

export const P_DICT: Record<PLang, PDict> = { de, en, es, ru };

function detect(): PLang {
  if (typeof window === 'undefined') return 'de';
  const saved = window.localStorage.getItem(STORAGE_KEY) as PLang | null;
  if (saved && P_DICT[saved]) return saved;
  const nav = (navigator.language || 'de').slice(0, 2).toLowerCase() as PLang;
  return P_DICT[nav] ? nav : 'de';
}

export function usePremiumLang() {
  const [lang, setLangState] = useState<PLang>(() => detect());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: PLang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  return { lang, setLang, t: P_DICT[lang] };
}

/** Übersetzt einen kanonischen deutschen Wert für die Anzeige. */
export function tv(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}
