import { useEffect, useState, useCallback } from 'react';

export type Lang = 'de' | 'en' | 'fr' | 'it' | 'es' | 'nl' | 'pl';

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
];

const STORAGE_KEY = 'alix.wizard.lang';

type Dict = {
  brand_tag: string;
  welcome_lead: string;
  start: string;
  step_of: (a: number, b: number) => string;
  back: string;
  next: string;
  submit: string;
  thanks_title: string;
  thanks_text: string;
  priority: string;
  multi_select: string;
  optional_multi: string;
  required: string;
  optional: string;
  // sections
  s_interests: string;
  s_additional: string;
  s_delivery: string;
  s_name: string;
  s_company: string;
  s_phone: string;
  s_email: string;
  s_consultation: string;
  s_notes: string;
  s_notes_hint: string;
  s_privacy: string;
  s_rating: string;
  s_rating_hint: string;
  // fields
  first_name: string;
  last_name: string;
  company_name: string;
  phone_placeholder: string;
  email_placeholder: string;
  consent_data: string;
  consent_contact: string;
  footer: string;
  // value translations (keys are the canonical German strings stored in DB)
  interests: Record<string, string>;
  additional: Record<string, string>;
  delivery: Record<string, string>;
  consultation: Record<string, string>;
};

export const DICT: Record<Lang, Dict> = {
  de: {
    brand_tag: '100% AI Full Technologie · Alix Lasers®',
    welcome_lead: 'Lass dich von Profis beraten und dir das beste Angebot erstellen.',
    start: 'START',
    step_of: (a, b) => `Schritt ${a} von ${b}`,
    back: 'Zurück', next: 'Weiter', submit: 'Anfrage absenden',
    thanks_title: 'Vielen Dank!',
    thanks_text: 'Ihre Anfrage ist bei uns eingegangen. Ein Berater meldet sich zeitnah.',
    priority: 'Bearbeitungs-Priorität',
    multi_select: 'Mehrfachauswahl möglich',
    optional_multi: 'Optional, Mehrfachauswahl',
    required: 'Pflichtfeld', optional: 'Optional',
    s_interests: 'Welche Bereiche interessieren Sie?',
    s_additional: 'Zusätzliche Interessen',
    s_delivery: 'Gewünschter Lieferzeitraum',
    s_name: 'Wie heißen Sie?',
    s_company: 'Firma',
    s_phone: 'Telefonnummer',
    s_email: 'E-Mail-Adresse',
    s_consultation: 'Beratungsart',
    s_notes: 'Weitere Informationen',
    s_notes_hint: 'Möchten Sie uns noch etwas zur Angebotserstellung mitteilen?',
    s_privacy: 'Datenschutz',
    s_rating: 'Wie haben Sie uns gefunden?',
    s_rating_hint: 'Optional – bewerten Sie Ihren bisherigen Eindruck',
    first_name: 'Vorname *', last_name: 'Nachname *', company_name: 'Firmenname',
    phone_placeholder: 'Telefonnummer', email_placeholder: 'name@firma.de',
    consent_data: 'Ich stimme der Verarbeitung meiner Daten zu.',
    consent_contact: 'Ich stimme der Kontaktaufnahme zu.',
    footer: '© Alix Lasers® · Alle Anfragen werden vertraulich behandelt.',
    interests: { 'Haarentfernung':'Haarentfernung','Gesichtsbehandlungen':'Gesichtsbehandlungen','Körperbehandlungen':'Körperbehandlungen','Medical Department':'Medical Department','Professional Kurs':'Professional Kurs','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'NiSV Ausbildung','Laserschulung':'Laserschulung','Finanzierungsmöglichkeiten':'Finanzierungsmöglichkeiten','Mietkauf / Miete / Smart Impulse':'Mietkauf / Miete / Smart Impulse','Katalog anfordern':'Katalog anfordern' },
    delivery: { 'schnellstmöglich':'schnellstmöglich','2–4 Wochen':'2–4 Wochen','4–8 Wochen':'4–8 Wochen','mehr als 8 Wochen':'mehr als 8 Wochen' },
    consultation: { 'Telefonische Beratung':'Telefonische Beratung','WhatsApp Beratung':'WhatsApp Beratung','Studio Beratung':'Studio Beratung','Alix Showroom':'Alix Showroom','Videoberatung':'Videoberatung' },
  },
  en: {
    brand_tag: '100% AI Full Technology · Alix Lasers®',
    welcome_lead: 'Get expert advice and the best tailored offer.',
    start: 'START',
    step_of: (a, b) => `Step ${a} of ${b}`,
    back: 'Back', next: 'Next', submit: 'Send request',
    thanks_title: 'Thank you!',
    thanks_text: 'Your request has been received. A consultant will get in touch shortly.',
    priority: 'Processing priority',
    multi_select: 'Multiple selection possible',
    optional_multi: 'Optional, multiple selection',
    required: 'Required', optional: 'Optional',
    s_interests: 'Which areas are you interested in?',
    s_additional: 'Additional interests',
    s_delivery: 'Preferred delivery period',
    s_name: 'What is your name?',
    s_company: 'Company',
    s_phone: 'Phone number',
    s_email: 'Email address',
    s_consultation: 'Type of consultation',
    s_notes: 'Additional information',
    s_notes_hint: 'Anything else we should know to prepare your offer?',
    s_privacy: 'Privacy',
    s_rating: 'How did you find us?',
    s_rating_hint: 'Optional – rate your impression so far',
    first_name: 'First name *', last_name: 'Last name *', company_name: 'Company name',
    phone_placeholder: 'Phone number', email_placeholder: 'name@company.com',
    consent_data: 'I agree to the processing of my data.',
    consent_contact: 'I agree to be contacted.',
    footer: '© Alix Lasers® · All requests are treated confidentially.',
    interests: { 'Haarentfernung':'Hair removal','Gesichtsbehandlungen':'Facial treatments','Körperbehandlungen':'Body treatments','Medical Department':'Medical department','Professional Kurs':'Professional course','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'NiSV training','Laserschulung':'Laser training','Finanzierungsmöglichkeiten':'Financing options','Mietkauf / Miete / Smart Impulse':'Lease-to-own / Rental / Smart Impulse','Katalog anfordern':'Request catalogue' },
    delivery: { 'schnellstmöglich':'as soon as possible','2–4 Wochen':'2–4 weeks','4–8 Wochen':'4–8 weeks','mehr als 8 Wochen':'more than 8 weeks' },
    consultation: { 'Telefonische Beratung':'Phone consultation','WhatsApp Beratung':'WhatsApp consultation','Studio Beratung':'Studio consultation','Alix Showroom':'Alix Showroom','Videoberatung':'Video consultation' },
  },
  fr: {
    brand_tag: '100% AI Full Technologie · Alix Lasers®',
    welcome_lead: 'Profitez des conseils de nos experts et de la meilleure offre sur mesure.',
    start: 'DÉMARRER',
    step_of: (a, b) => `Étape ${a} sur ${b}`,
    back: 'Retour', next: 'Suivant', submit: 'Envoyer la demande',
    thanks_title: 'Merci !',
    thanks_text: 'Nous avons bien reçu votre demande. Un conseiller vous contactera rapidement.',
    priority: 'Priorité de traitement',
    multi_select: 'Sélection multiple possible',
    optional_multi: 'Optionnel, sélection multiple',
    required: 'Obligatoire', optional: 'Optionnel',
    s_interests: 'Quels domaines vous intéressent ?',
    s_additional: 'Intérêts complémentaires',
    s_delivery: 'Délai de livraison souhaité',
    s_name: 'Comment vous appelez-vous ?',
    s_company: 'Société',
    s_phone: 'Numéro de téléphone',
    s_email: 'Adresse e-mail',
    s_consultation: 'Type de consultation',
    s_notes: 'Informations complémentaires',
    s_notes_hint: 'Souhaitez-vous nous transmettre des éléments pour préparer votre offre ?',
    s_privacy: 'Confidentialité',
    s_rating: 'Comment nous avez-vous trouvés ?',
    s_rating_hint: 'Optionnel – évaluez votre impression',
    first_name: 'Prénom *', last_name: 'Nom *', company_name: 'Nom de la société',
    phone_placeholder: 'Numéro de téléphone', email_placeholder: 'nom@societe.fr',
    consent_data: 'J’accepte le traitement de mes données.',
    consent_contact: 'J’accepte d’être contacté(e).',
    footer: '© Alix Lasers® · Toutes les demandes sont traitées de manière confidentielle.',
    interests: { 'Haarentfernung':'Épilation','Gesichtsbehandlungen':'Soins du visage','Körperbehandlungen':'Soins du corps','Medical Department':'Département médical','Professional Kurs':'Formation professionnelle','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'Formation NiSV','Laserschulung':'Formation laser','Finanzierungsmöglichkeiten':'Options de financement','Mietkauf / Miete / Smart Impulse':'Location-vente / Location / Smart Impulse','Katalog anfordern':'Demander le catalogue' },
    delivery: { 'schnellstmöglich':'dès que possible','2–4 Wochen':'2–4 semaines','4–8 Wochen':'4–8 semaines','mehr als 8 Wochen':'plus de 8 semaines' },
    consultation: { 'Telefonische Beratung':'Conseil téléphonique','WhatsApp Beratung':'Conseil WhatsApp','Studio Beratung':'Conseil en studio','Alix Showroom':'Alix Showroom','Videoberatung':'Conseil vidéo' },
  },
  it: {
    brand_tag: '100% AI Full Technology · Alix Lasers®',
    welcome_lead: 'Fatti consigliare dai nostri esperti e ricevi l’offerta migliore.',
    start: 'INIZIA',
    step_of: (a, b) => `Passo ${a} di ${b}`,
    back: 'Indietro', next: 'Avanti', submit: 'Invia richiesta',
    thanks_title: 'Grazie!',
    thanks_text: 'La tua richiesta è stata ricevuta. Un consulente ti contatterà a breve.',
    priority: 'Priorità di elaborazione',
    multi_select: 'Selezione multipla possibile',
    optional_multi: 'Opzionale, selezione multipla',
    required: 'Obbligatorio', optional: 'Opzionale',
    s_interests: 'Quali aree ti interessano?',
    s_additional: 'Interessi aggiuntivi',
    s_delivery: 'Periodo di consegna desiderato',
    s_name: 'Come ti chiami?',
    s_company: 'Azienda',
    s_phone: 'Numero di telefono',
    s_email: 'Indirizzo email',
    s_consultation: 'Tipo di consulenza',
    s_notes: 'Ulteriori informazioni',
    s_notes_hint: 'Vuoi comunicarci qualcosa per preparare la tua offerta?',
    s_privacy: 'Privacy',
    s_rating: 'Come ci hai trovati?',
    s_rating_hint: 'Opzionale – valuta la tua impressione',
    first_name: 'Nome *', last_name: 'Cognome *', company_name: 'Nome azienda',
    phone_placeholder: 'Numero di telefono', email_placeholder: 'nome@azienda.it',
    consent_data: 'Acconsento al trattamento dei miei dati.',
    consent_contact: 'Acconsento ad essere contattato.',
    footer: '© Alix Lasers® · Tutte le richieste sono trattate in modo riservato.',
    interests: { 'Haarentfernung':'Epilazione','Gesichtsbehandlungen':'Trattamenti viso','Körperbehandlungen':'Trattamenti corpo','Medical Department':'Reparto medicale','Professional Kurs':'Corso professionale','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'Formazione NiSV','Laserschulung':'Formazione laser','Finanzierungsmöglichkeiten':'Opzioni di finanziamento','Mietkauf / Miete / Smart Impulse':'Riscatto / Noleggio / Smart Impulse','Katalog anfordern':'Richiedi il catalogo' },
    delivery: { 'schnellstmöglich':'il prima possibile','2–4 Wochen':'2–4 settimane','4–8 Wochen':'4–8 settimane','mehr als 8 Wochen':'oltre 8 settimane' },
    consultation: { 'Telefonische Beratung':'Consulenza telefonica','WhatsApp Beratung':'Consulenza WhatsApp','Studio Beratung':'Consulenza in studio','Alix Showroom':'Alix Showroom','Videoberatung':'Consulenza video' },
  },
  es: {
    brand_tag: '100% AI Full Technology · Alix Lasers®',
    welcome_lead: 'Recibe asesoramiento de expertos y la mejor oferta personalizada.',
    start: 'EMPEZAR',
    step_of: (a, b) => `Paso ${a} de ${b}`,
    back: 'Atrás', next: 'Siguiente', submit: 'Enviar solicitud',
    thanks_title: '¡Gracias!',
    thanks_text: 'Hemos recibido tu solicitud. Un asesor se pondrá en contacto contigo en breve.',
    priority: 'Prioridad de procesamiento',
    multi_select: 'Selección múltiple posible',
    optional_multi: 'Opcional, selección múltiple',
    required: 'Obligatorio', optional: 'Opcional',
    s_interests: '¿Qué áreas te interesan?',
    s_additional: 'Intereses adicionales',
    s_delivery: 'Plazo de entrega deseado',
    s_name: '¿Cómo te llamas?',
    s_company: 'Empresa',
    s_phone: 'Número de teléfono',
    s_email: 'Correo electrónico',
    s_consultation: 'Tipo de asesoramiento',
    s_notes: 'Información adicional',
    s_notes_hint: '¿Quieres contarnos algo más para preparar tu oferta?',
    s_privacy: 'Privacidad',
    s_rating: '¿Cómo nos encontraste?',
    s_rating_hint: 'Opcional – valora tu impresión',
    first_name: 'Nombre *', last_name: 'Apellido *', company_name: 'Nombre de la empresa',
    phone_placeholder: 'Número de teléfono', email_placeholder: 'nombre@empresa.es',
    consent_data: 'Acepto el tratamiento de mis datos.',
    consent_contact: 'Acepto ser contactado.',
    footer: '© Alix Lasers® · Todas las solicitudes se tratan con confidencialidad.',
    interests: { 'Haarentfernung':'Depilación','Gesichtsbehandlungen':'Tratamientos faciales','Körperbehandlungen':'Tratamientos corporales','Medical Department':'Departamento médico','Professional Kurs':'Curso profesional','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'Formación NiSV','Laserschulung':'Formación láser','Finanzierungsmöglichkeiten':'Opciones de financiación','Mietkauf / Miete / Smart Impulse':'Alquiler con opción a compra / Alquiler / Smart Impulse','Katalog anfordern':'Solicitar catálogo' },
    delivery: { 'schnellstmöglich':'lo antes posible','2–4 Wochen':'2–4 semanas','4–8 Wochen':'4–8 semanas','mehr als 8 Wochen':'más de 8 semanas' },
    consultation: { 'Telefonische Beratung':'Asesoramiento telefónico','WhatsApp Beratung':'Asesoramiento por WhatsApp','Studio Beratung':'Asesoramiento en estudio','Alix Showroom':'Alix Showroom','Videoberatung':'Videoasesoramiento' },
  },
  nl: {
    brand_tag: '100% AI Full Technology · Alix Lasers®',
    welcome_lead: 'Laat u door experts adviseren en ontvang het beste aanbod op maat.',
    start: 'START',
    step_of: (a, b) => `Stap ${a} van ${b}`,
    back: 'Terug', next: 'Verder', submit: 'Aanvraag verzenden',
    thanks_title: 'Bedankt!',
    thanks_text: 'Uw aanvraag is ontvangen. Een adviseur neemt spoedig contact met u op.',
    priority: 'Verwerkingsprioriteit',
    multi_select: 'Meerdere keuzes mogelijk',
    optional_multi: 'Optioneel, meerdere keuzes',
    required: 'Verplicht', optional: 'Optioneel',
    s_interests: 'Welke gebieden interesseren u?',
    s_additional: 'Aanvullende interesses',
    s_delivery: 'Gewenste levertermijn',
    s_name: 'Wat is uw naam?',
    s_company: 'Bedrijf',
    s_phone: 'Telefoonnummer',
    s_email: 'E-mailadres',
    s_consultation: 'Type advies',
    s_notes: 'Aanvullende informatie',
    s_notes_hint: 'Wilt u ons nog iets meegeven voor uw offerte?',
    s_privacy: 'Privacy',
    s_rating: 'Hoe heeft u ons gevonden?',
    s_rating_hint: 'Optioneel – beoordeel uw indruk',
    first_name: 'Voornaam *', last_name: 'Achternaam *', company_name: 'Bedrijfsnaam',
    phone_placeholder: 'Telefoonnummer', email_placeholder: 'naam@bedrijf.nl',
    consent_data: 'Ik ga akkoord met de verwerking van mijn gegevens.',
    consent_contact: 'Ik ga akkoord met contactopname.',
    footer: '© Alix Lasers® · Alle aanvragen worden vertrouwelijk behandeld.',
    interests: { 'Haarentfernung':'Ontharing','Gesichtsbehandlungen':'Gezichtsbehandelingen','Körperbehandlungen':'Lichaamsbehandelingen','Medical Department':'Medische afdeling','Professional Kurs':'Professionele cursus','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'NiSV-opleiding','Laserschulung':'Laseropleiding','Finanzierungsmöglichkeiten':'Financieringsmogelijkheden','Mietkauf / Miete / Smart Impulse':'Huurkoop / Huur / Smart Impulse','Katalog anfordern':'Catalogus aanvragen' },
    delivery: { 'schnellstmöglich':'zo snel mogelijk','2–4 Wochen':'2–4 weken','4–8 Wochen':'4–8 weken','mehr als 8 Wochen':'meer dan 8 weken' },
    consultation: { 'Telefonische Beratung':'Telefonisch advies','WhatsApp Beratung':'WhatsApp-advies','Studio Beratung':'Advies in studio','Alix Showroom':'Alix Showroom','Videoberatung':'Videoadvies' },
  },
  pl: {
    brand_tag: '100% AI Full Technology · Alix Lasers®',
    welcome_lead: 'Skorzystaj z porady ekspertów i otrzymaj najlepszą ofertę.',
    start: 'START',
    step_of: (a, b) => `Krok ${a} z ${b}`,
    back: 'Wstecz', next: 'Dalej', submit: 'Wyślij zapytanie',
    thanks_title: 'Dziękujemy!',
    thanks_text: 'Twoje zapytanie zostało odebrane. Doradca skontaktuje się wkrótce.',
    priority: 'Priorytet realizacji',
    multi_select: 'Wybór wielokrotny możliwy',
    optional_multi: 'Opcjonalnie, wybór wielokrotny',
    required: 'Pole wymagane', optional: 'Opcjonalnie',
    s_interests: 'Jakie obszary Cię interesują?',
    s_additional: 'Dodatkowe zainteresowania',
    s_delivery: 'Preferowany termin dostawy',
    s_name: 'Jak masz na imię?',
    s_company: 'Firma',
    s_phone: 'Numer telefonu',
    s_email: 'Adres e-mail',
    s_consultation: 'Rodzaj konsultacji',
    s_notes: 'Dodatkowe informacje',
    s_notes_hint: 'Czy chcesz nam przekazać coś jeszcze do przygotowania oferty?',
    s_privacy: 'Prywatność',
    s_rating: 'Jak nas znalazłeś?',
    s_rating_hint: 'Opcjonalnie – oceń swoje wrażenie',
    first_name: 'Imię *', last_name: 'Nazwisko *', company_name: 'Nazwa firmy',
    phone_placeholder: 'Numer telefonu', email_placeholder: 'imie@firma.pl',
    consent_data: 'Wyrażam zgodę na przetwarzanie moich danych.',
    consent_contact: 'Wyrażam zgodę na kontakt.',
    footer: '© Alix Lasers® · Wszystkie zapytania traktowane są poufnie.',
    interests: { 'Haarentfernung':'Depilacja','Gesichtsbehandlungen':'Zabiegi na twarz','Körperbehandlungen':'Zabiegi na ciało','Medical Department':'Dział medyczny','Professional Kurs':'Kurs profesjonalny','Alix Academy':'Alix Academy' },
    additional: { 'NiSV Ausbildung':'Szkolenie NiSV','Laserschulung':'Szkolenie laserowe','Finanzierungsmöglichkeiten':'Opcje finansowania','Mietkauf / Miete / Smart Impulse':'Najem z opcją wykupu / Najem / Smart Impulse','Katalog anfordern':'Zamów katalog' },
    delivery: { 'schnellstmöglich':'jak najszybciej','2–4 Wochen':'2–4 tygodnie','4–8 Wochen':'4–8 tygodni','mehr als 8 Wochen':'powyżej 8 tygodni' },
    consultation: { 'Telefonische Beratung':'Konsultacja telefoniczna','WhatsApp Beratung':'Konsultacja WhatsApp','Studio Beratung':'Konsultacja w studiu','Alix Showroom':'Alix Showroom','Videoberatung':'Konsultacja wideo' },
  },
};

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'de';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && DICT[stored]) return stored;
    const url = new URLSearchParams(window.location.search).get('lang') as Lang | null;
    if (url && DICT[url]) return url;
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase() as Lang;
    if (DICT[nav]) return nav;
  } catch { /* ignore */ }
  return 'de';
}

export function useWizardLang() {
  const [lang, setLangState] = useState<Lang>(() => detectLang());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && DICT[e.newValue as Lang]) {
        setLangState(e.newValue as Lang);
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as Lang;
      if (detail && DICT[detail]) setLangState(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('alix:wizard-lang', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('alix:wizard-lang', onCustom);
    };
  }, []);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('alix:wizard-lang', { detail: l }));
    setLangState(l);
  }, []);
  return { lang, setLang, t: DICT[lang] };
}
