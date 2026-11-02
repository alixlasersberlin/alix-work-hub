# ALIXSMART WhatsApp Sales: benötigte Verbindung für Meine Leads

ALIXSMART ist ein separates Projekt. Sein bestehender Twilio-Sales-Chat bleibt führend; ALIXWORK darf keinen zweiten Sender anschließen. Die aktuelle Sitzungsübergabe allein genügt nicht für eingebettetes Lesen und Antworten.

## Im ALIXSMART-Projekt zu ergänzen oder zu bestätigen

- Geschützte serverseitige Schnittstelle mit getrenntem Integrationszugang, kein Browser-Schlüssel und kein allgemeiner Zugriff auf alle Konversationen.
- Autorisierte Zuordnung zwischen ALIXWORK-Lead-ID, Mandant, Kontakt-ID und Sales-Konversations-ID. Ein Integrationsschlüssel allein ist kein ausreichender Nachweis für die Mitarbeiterberechtigung.
- Signierte, kurzlebige Anfragen mit Nutzeridentität, Lead-ID, Mandant und bestätigter Konversationszuordnung; Zeitstempel/Nonce gegen Wiederholung. ALIXWORK prüft bei jedem Aufruf die aktuelle Zuweisung, ALIXSMART die Konversationsberechtigung.
- Kontrollierte Kontaktzuordnung: Kontakt-ID bevorzugt, Telefonnummern normalisieren, Mehrdeutigkeiten zurückmelden, nicht den ersten Treffer wählen.
- Verlauf paginiert lesen und durchsuchen; Nachrichten mit stabiler externer ID, Richtung, Zeitpunkt, Medieninformationen, Zustellstatus und Fehlern zurückgeben.
- Neue Nachrichten/Statusänderungen über authentifizierte, deduplizierte Ereignisse mit überprüfbarer Signatur und Event-ID liefern. Erneute Zustellung darf keinen zweiten Historieneintrag erzeugen.
- Schreiben über den vorhandenen `send-whatsapp-message`-Versanddienst: Idempotenzschlüssel, autorisierter Empfänger, bestehende Twilio-Sales-Konfiguration.
- 24-Stunden-Fenster serverseitig anhand letzter Kundennachricht prüfen; außerhalb ausschließlich bestätigte Vorlagen mit passenden Parametern.
- Angebots-PDF nur nach ALIXWORK-Freigabeprüfung und mit temporärem, berechtigten Dateizugriff; keine öffentlichen Dauerlinks auf vertrauliche Dokumente.
- Medien abrufen/versenden, ungelesene Nachrichten markieren, Statusänderungen zurückgeben. Annahme durch Anbieter nicht als Zustellung ausgeben.
- Keine Auftragsannahme aus Chattext ableiten.

## Abnahme

Zwei kontrollierte Mitarbeiter mit getrennten Leads und Chats testen. Fremde Konversations-ID, geänderte Leadzuweisung, falscher Mandant, abgelaufene Signatur und doppelte Nachricht müssen sicher abgefangen werden. Echten Kundenversand erst nach gesonderter Freigabe.

Die Verbindung ist in ALIXWORK noch nicht aktiv. Bis der Vertrag und die Erreichbarkeit bestätigt sind, zeigt Meine Leads „Nicht verbunden“. Änderungen am ALIXSMART-Projekt sind aus diesem Projekt nicht möglich; dessen Chat muss für diese Ergänzung separat geöffnet werden.