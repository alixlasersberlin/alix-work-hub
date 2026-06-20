INSERT INTO public.app_settings (key, value, updated_by)
VALUES (
  'anzahlung_mahnung_config',
  $JSON${
    "sender": {
      "email_from": "buchhaltung@alixlasers.de",
      "email_from_name": "Alix Lasers Buchhaltung",
      "sms_sender": "ALIXLASERS"
    },
    "bank": {
      "account_holder": "Alix Lasers GmbH",
      "bank_name": "",
      "iban": "",
      "bic": ""
    },
    "stages": [
      {
        "id": "stage1",
        "name": "Zahlungserinnerung",
        "days_after_due": 7,
        "enabled": true,
        "email_subject": "Freundliche Zahlungserinnerung – Anzahlung {orderNumber}",
        "email_body": "Sehr geehrte Damen und Herren {customerName},\n\nzu Ihrer Bestellung {orderNumber} haben wir Ihnen eine Anzahlungsrechnung über {depositAmount} übermittelt. Nach unseren Unterlagen ist der Betrag noch nicht eingegangen.\n\nMöglicherweise hat sich Ihre Überweisung mit dieser Erinnerung überschnitten – in diesem Fall betrachten Sie diese bitte als gegenstandslos.\n\nBankverbindung:\n{bankName}\nIBAN: {iban}\nBIC: {bic}\nVerwendungszweck: {orderNumber}\n\nMit freundlichen Grüßen\n{senderName}",
        "sms_body": "Freundliche Erinnerung: Ihre Anzahlung über {depositAmount} zu Auftrag {orderNumber} ist noch offen. Bitte zeitnah überweisen. Danke! – Alix Lasers"
      },
      {
        "id": "stage2",
        "name": "1. Mahnung",
        "days_after_due": 14,
        "enabled": true,
        "email_subject": "1. Mahnung – Anzahlung {orderNumber}",
        "email_body": "Sehr geehrte Damen und Herren {customerName},\n\ntrotz unserer Zahlungserinnerung konnten wir bisher keinen Zahlungseingang für die Anzahlung Ihrer Bestellung {orderNumber} in Höhe von {depositAmount} feststellen.\n\nWir bitten Sie, den Betrag innerhalb der nächsten 7 Tage zu überweisen.\n\nBankverbindung:\n{bankName}\nIBAN: {iban}\nBIC: {bic}\nVerwendungszweck: {orderNumber}\n\nMit freundlichen Grüßen\n{senderName}",
        "sms_body": "1. Mahnung: Ihre Anzahlung über {depositAmount} zu Auftrag {orderNumber} ist überfällig. Bitte umgehend überweisen. – Alix Lasers"
      },
      {
        "id": "stage3",
        "name": "2. Mahnung",
        "days_after_due": 30,
        "enabled": true,
        "email_subject": "2. Mahnung – Anzahlung {orderNumber}",
        "email_body": "Sehr geehrte Damen und Herren {customerName},\n\ntrotz mehrfacher Erinnerung ist die Anzahlung in Höhe von {depositAmount} zu Auftrag {orderNumber} bis heute nicht bei uns eingegangen.\n\nWir setzen Ihnen hiermit eine letzte Frist von 7 Tagen. Sollte der Betrag bis dahin nicht eingegangen sein, behalten wir uns weitere Schritte vor.\n\nBankverbindung:\n{bankName}\nIBAN: {iban}\nBIC: {bic}\nVerwendungszweck: {orderNumber}\n\nMit freundlichen Grüßen\n{senderName}",
        "sms_body": "2. Mahnung: Anzahlung {depositAmount} zu Auftrag {orderNumber} weiterhin offen. Letzte Frist 7 Tage. – Alix Lasers"
      }
    ]
  }$JSON$,
  NULL
)
ON CONFLICT (key) DO NOTHING;