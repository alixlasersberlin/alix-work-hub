// Minimal i18n scaffolding for the public booking portal.
// Full translation tables can be filled progressively; missing keys fall back to German.
export type BookingLang = 'de' | 'en' | 'tr' | 'ar' | 'vi' | 'ru';

type Dict = Record<string, string>;

const de: Dict = {
  greeting: 'Termin online buchen',
  intro: 'Wählen Sie eine Leistung und einen passenden Termin. Sie erhalten anschließend eine Bestätigung per E-Mail.',
  step_department: 'Leistung',
  step_service: 'Terminart',
  step_location: 'Standort',
  step_time: 'Zeit',
  step_contact: 'Kontakt',
  step_summary: 'Zusammenfassung',
  back: 'Zurück',
  next: 'Weiter',
  submit: 'Buchung absenden',
  privacy: 'Datenschutz akzeptiert',
  consent_email: 'Ich stimme dem Empfang von E-Mails zu diesem Termin zu',
  consent_marketing: 'Optional: Ich möchte weitere Angebote per E-Mail erhalten',
  first_name: 'Vorname',
  last_name: 'Nachname',
  company: 'Firma',
  email: 'E-Mail',
  phone: 'Telefon',
  website: 'Webseite',
  message: 'Nachricht',
  contact_person: 'Gewünschter Ansprechpartner',
  no_slots: 'Für den gewählten Tag sind keine Zeiten verfügbar.',
  online_meeting: 'Online-Termin',
  duration: 'Dauer',
  location: 'Standort',
  thanks_title: 'Vielen Dank!',
  thanks_text: 'Ihre Buchungsanfrage ist bei uns eingegangen. Sie erhalten in Kürze eine Bestätigung per E-Mail.',
  booking_number: 'Buchungsnummer',
  add_to_calendar: 'In Kalender übernehmen',
  reschedule: 'Termin verschieben',
  cancel: 'Termin absagen',
  confirm: 'Termin bestätigen',
  waitlist_join: 'Auf Warteliste setzen',
};

const en: Dict = {
  greeting: 'Book your appointment online',
  intro: 'Choose a service and a suitable time. You will receive a confirmation by e-mail.',
  step_department: 'Service',
  step_service: 'Type',
  step_location: 'Location',
  step_time: 'Time',
  step_contact: 'Contact',
  step_summary: 'Summary',
  back: 'Back',
  next: 'Next',
  submit: 'Submit booking',
  privacy: 'I accept the privacy policy',
  consent_email: 'I agree to receive e-mails about this appointment',
  consent_marketing: 'Optional: I would like to receive further offers',
  first_name: 'First name',
  last_name: 'Last name',
  company: 'Company',
  email: 'E-mail',
  phone: 'Phone',
  website: 'Website',
  message: 'Message',
  contact_person: 'Preferred contact person',
  no_slots: 'No time slots available for the chosen day.',
  online_meeting: 'Online meeting',
  duration: 'Duration',
  location: 'Location',
  thanks_title: 'Thank you!',
  thanks_text: 'Your booking request has been received. A confirmation e-mail is on its way.',
  booking_number: 'Booking reference',
  add_to_calendar: 'Add to calendar',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  confirm: 'Confirm',
  waitlist_join: 'Join waitlist',
};

const dicts: Record<BookingLang, Dict> = { de, en, tr: {}, ar: {}, vi: {}, ru: {} };

export function t(lang: BookingLang, key: string): string {
  return dicts[lang]?.[key] || de[key] || key;
}
