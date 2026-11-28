# Gezielte Zugangsdaten-/Konto-Prüfung zur gesonderten Freigabe

Keine Rotation, Kontosperre oder Sitzungswiderruf durch diesen Auftrag ausgeführt. Keine Geheimniswerte in diesen Unterlagen.

## A0-01: exponierter temporärer Passwortpfad

Der fest kodierte Passwortwert wurde aus dem aktuellen Handler entfernt; historische Repository-Versionen können ihn weiterhin enthalten. Der Endpunkt ist live vollständig für Ausführungen gesperrt. Ob das betroffene Konto derzeit existiert, diesen Wert verwendet oder zuvor missbräuchlich geändert wurde, wurde nicht durch einen Loginversuch geprüft.

Separat vorzulegen: genaue Identifikation des ursprünglich fest hinterlegten Kontos in der bestehenden geschützten Benutzerverwaltung, Prüfung aktueller Auth-/Audit- und Sitzungsevidenz, dann nach ausdrücklicher Freigabe ausschließlich dieses Passwort zurücksetzen, erforderlichen Passwortwechsel erzwingen und betroffene Sitzungen widerrufen. Keine anderen Benutzer sperren, keine Kennwörter in Berichte übernehmen, keinen echten Einladungs-/Kundenversand als Test durchführen.

## A0-03: möglicher Product-Hub-Quellschlüsselabfluss

Quellcode verwendet `DE_EXPORT_API_KEY` mit Fallback `PRODUCT_HUB_SOURCE_KEY` für einen frei überschreibbaren Quell-Fetch. Dieser Pfad bleibt derzeit blockiert für die Korrekturumsetzung, nicht als live gesperrter Endpoint behauptet. Er wurde nicht mit einer fremden URL oder einem echten Schlüssel getestet. Bestehende DE-/COM-Bundle-/Notify-/Status-Schlüssel nicht ändern.

Separat vorzulegen: erlaubter Exportanbieter und exaktes HTTPS-Ziel, alle Nutzer desselben Quellschlüssels und vorhandene Redirect-/Egress-/Provider-Auditbeweise identifizieren. Zuerst Quelle/Caller-/Fetch-Grenze sicher abnehmen; nur bei gezieltem Verdacht auf den konkret zugeordneten Schlüssel und ausdrücklicher Freigabe diesen beim jeweiligen Anbieter erneuern und die serverseitige Secret-Zuordnung koordiniert umstellen. Keine pauschale Rotation aller API-Schlüssel, keine Schlüsselwerte im Chat oder in Berichten.

Eine neue Secret-Version darf keinen ungeschützten Altpfad wieder öffnen; bei Problemen betroffenen Quellpfad eng gesperrt halten. Zeitpläne und Produktiv-/Pilotfreigaben bleiben unverändert.
