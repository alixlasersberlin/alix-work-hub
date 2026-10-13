import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Einmalige Trustpilot-Kampagne (Okt 2026): Kunden mit Status „geliefert" der letzten 12 Monate.
const RECIPIENTS: [string, string][] = [
  ["22 Studios","helenehuhn@icloud.com"],["Aesthetic Laser Lyas","aestheticlaserlyas@outlook.de"],["Anja von der Mey","demvondermey@gmail.com"],["Anna Beauty Lux","nikdie777@gmail.com"],["Aura Beauty KG Emine Yikilmaz","emineyikilmaz92@icloud.com"],["Aveen Osso","avinosso@icloud.com"],["Ayman Shekhmus","aymanshekhmus4@gmail.com"],["Beauty Studio Dona","edona-shabani@web.de"],["Beauty Studio Rajkovic KG","krajkovi00@gmail.com"],["BeautyRoomByYlenia","yleniamagliocco66@gmail.com"],["BodyLab Olena Khilobok","elenakhilobok@gmail.com"],["Chic Beauty","metin.uzun@outlook.at"],["Delalé Cosmetics","info@delalecosmetics.de"],["Dhuha Alshabani","alshabani_dhuha@yahoo.com"],["Dorina Kaludra","dorina.ka@icloud.com"],["Dr. Olga Borsai","olha1369@gmail.com"],["Dr. Susanne Kroemer","ordination@drkroemer.info"],["Egzona Rashani","xonela@icloud.com"],["Eitner","rdeitner@icloud.com"],["Elena Schweizer","elena-schweizer@gmx.de"],["Eli Ostad","elixmix@yahoo.com"],["Eliana da silva Rodrigues","elyro28hh@gmail.com"],["Eren Karadayi","eren.karadayi@outlook.com"],["Farshid Bayat","emofarshid@gmail.com"],["G-Beauty-Lounge","shahnazmetini3@gmail.com"],["Gioia Viso","gioiaviso@gmail.com"],["Golden Rose","noor88n@hotmail.com"],["H Nails","emi_hyvong_267@yahoo.com"],["Haare -Gesicht -Körper","hurtfriseure@gmail.com"],["Hautarztpraxis Buckow","info@dermatologie-buckow.de"],["Ian Kipenko","ynkpnk@gmail.com"],["Ilona Baidala","baydalailona@gmail.com"],["Iveta Krasteva","iveta_krusteva1997@abv.bg"],["Korean Beauty & Wellness","vmn1212@gmail.com"],["Kosmetik & Wellness Studio Möller-Brang","info@moeller-brang.de"],["Kosmetik Hautnah","radakovic.nada@yahoo.de"],["La Perle","atillaali57@gmail.com"],["LANA Praxis für Fußpflege und Laser GbR","heiko.hoehn@hanseatic-travel.de"],["Laserglow.Beauty Clinic Berlin","asyasu0505@gmail.com"],["Laserlabs Kosmetik GmbH","office@laserlabs.at"],["Laurentine Mbem Som","lola.virtuellassistenz.fr@gmail.com"],["Loupa GmbH","loupa@mail.de"],["Magdalena Tzika","info@ledisfirst.de"],["Maryam El Jerbi","merymimo7@icloud.com"],["Mehrnaz Gachizadeh","m.gachizadeh@yahoo.de"],["Melimedics","info@melimedics.de"],["Melisa Dzafic","meloxaesthetic@gmail.com"],["Melody Nails @ Spa","hamhamberlin90@gmail.com"],["Mihdiye Yilmaz","mihdiye.yilmaz@hotmail.com"],["Na Beauty Spa","haku_love2002@yahoo.com"],["Nails & Beauty","lisa.colantuono@hotmail.fr"],["Nuran Torun","antorun@hotmail.de"],["Olha Petrova","gluka_2005@ukr.net"],["Peak of Beauty","info@peakofbeauty.at"],["Riccardo Fajdetic","riccardo.fajdetic@gmail.com"],["Rim Jomaa","gueluenel@outlook.com"],["Rosebeauty GbR","isenhofernahid@yahoo.com"],["SADIYEM Laser und Cosmetik","sadiye.karaca@gmx.de"],["Saranda Afuzi","sarandaafuzi@hotmail.com"],["Sevilay Teke","sevilayk@hotmail.de"],["SINEM UCAR Kosmetikstudio e.U","buelent.ucar@hotmail.com"],["Studio Elena","sestanjmarijana0@gmail.com"],["Sugar-Lady","goldnaum@gmail.com"],["Tasdemir","info@zthemaster.de"],["The Laser Lounge","ranayassine@gmx.de"],["Thi Thanh Hang Ta","hangta1611@gmail.com"],["Tonita Tatiana-Denisa","denisa.dumbra@yahoo.com"],["Vanessa Düvel","lashliciousvd@outlook.com"],["Yarar Cebrail","amed21q47@gmail.com"],
];

const SUBJECT = "Herzlichen Dank für Ihr Vertrauen in Alix Lasers Deutschland";
const BCC = ["www.alix-lasers.de+42bf271ca4@invite.trustpilot.com", "service@alix-lasers.com"];
const HTML = `<p>Sehr geehrte Kundinnen und Kunden,</p><p>gemeinsam mit Ihnen haben wir einen weiteren bedeutenden Meilenstein erreicht!</p><p>Dank Ihres Vertrauens, Ihrer Unterstützung und Ihrer wertvollen Erfahrungen mit unseren Geräten konnten wir die Entwicklung und Qualität unserer Produkte kontinuierlich verbessern.</p><p>Mit großer Freude möchten wir Ihnen mitteilen, dass wir einen wichtigen Schritt im Rahmen der ISO 13485 – dem international anerkannten Qualitätsmanagementstandard für Medizinprodukte – erfolgreich abgeschlossen haben.</p><p>Auch unser europäisches Zertifizierungsverfahren nach der Medical Device Regulation (EU) 2017/745 (MDR) befindet sich bereits in einer fortgeschrittenen Phase.</p><p>Die wesentlichen Vorbereitungsschritte wurden absolviert. Aktuell befinden wir uns im abschließenden Zertifizierungsprozess in Zusammenarbeit mit unserer Benannten Stelle.</p><p>Unser Ziel: Noch höhere Qualitätsstandards, maximale Produktsicherheit und innovative Technologien für Ihren Behandlungserfolg.</p><p><strong>Jetzt benötigen wir erneut Ihre Unterstützung!</strong></p><p>Ihre Zufriedenheit und Ihre persönlichen Erfahrungen sind für uns von unschätzbarem Wert.</p><p>Deshalb möchten wir Sie herzlich bitten, sich einen kurzen Moment Zeit zu nehmen und Ihre Erfahrungen mit Ihrem Alix Lasers Gerät sowie unserem Unternehmen auf Trustpilot zu teilen.</p><p>⭐ <strong>Bewerten Sie Alix Lasers Deutschland:</strong><br><a href="https://de.trustpilot.com/evaluate/www.alix-lasers.de">https://de.trustpilot.com/evaluate/www.alix-lasers.de</a></p><p>Ob Sie besonders zufrieden sind oder Verbesserungsvorschläge haben – jede ehrliche Bewertung hilft uns, unsere Produkte und unseren Service weiterzuentwickeln.</p><p>Gemeinsam gestalten wir die Zukunft der professionellen Lasertechnologie.</p><p>Wir bedanken uns herzlich für Ihr Vertrauen, Ihre Treue und die erfolgreiche Zusammenarbeit.</p><p>Mit besten Grüßen</p><p>Lars Scheidler<br>Alix Lasers Deutschland</p>`;

const KEY = "alix_trustpilot_kampagne_2026_10";
type St = "ok" | "err" | "busy";

export default function TrustpilotKampagne() {
  const [status, setStatus] = useState<Record<string, St>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);

  const save = (s: Record<string, St>) => {
    const persist = Object.fromEntries(Object.entries(s).filter(([, v]) => v === "ok"));
    localStorage.setItem(KEY, JSON.stringify(persist));
  };

  const run = async () => {
    if (!confirm(`E-Mail jetzt an ${RECIPIENTS.filter(([, e]) => status[e] !== "ok").length} Kunden senden?`)) return;
    setRunning(true);
    const cur = { ...status };
    for (const [name, email] of RECIPIENTS) {
      if (cur[email] === "ok") continue;
      cur[email] = "busy"; setStatus({ ...cur });
      const { data, error } = await supabase.functions.invoke("send-mail", {
        body: { to_email: email, to_name: name, from_email: "service@alixwork.de", subject: SUBJECT,
          body_html: HTML, bcc: BCC, skip_system_copies: true, skip_signature: true },
      });
      if (error || (data as any)?.error) {
        cur[email] = "err";
        setErrors((p) => ({ ...p, [email]: error?.message ?? String((data as any)?.error) }));
      } else cur[email] = "ok";
      setStatus({ ...cur }); save(cur);
    }
    setRunning(false);
  };

  const ok = RECIPIENTS.filter(([, e]) => status[e] === "ok").length;
  const err = RECIPIENTS.filter(([, e]) => status[e] === "err").length;

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trustpilot-Kampagne · {RECIPIENTS.length} Kunden</CardTitle>
          <Button onClick={run} disabled={running || ok === RECIPIENTS.length}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {ok === RECIPIENTS.length ? "Alle versendet" : running ? `Sende … ${ok}/${RECIPIENTS.length}` : "Jetzt senden"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="text-muted-foreground">Betreff: {SUBJECT} · BCC: {BCC.join(", ")}</div>
          <div>Versendet: {ok} · Fehler: {err}</div>
          <table className="w-full">
            <tbody>
              {RECIPIENTS.map(([n, e]) => (
                <tr key={e}>
                  <td className="py-1">{n}</td><td className="text-muted-foreground">{e}</td>
                  <td className="w-8">
                    {status[e] === "ok" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    {status[e] === "err" && <span title={errors[e]}><XCircle className="h-4 w-4 text-destructive" /></span>}
                    {status[e] === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
