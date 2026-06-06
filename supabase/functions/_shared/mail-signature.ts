// Alix Lasers – einheitliche Signatur für alle ausgehenden Mails
export function buildSignatureHtml(loginName: string): string {
  const safeName = String(loginName || "Alix Lasers Team")
    .replace(/[<>&"]/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string),
    );
  return `
<div style="margin-top:32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;line-height:1.55">
  <div style="font-weight:700;color:#0a0a0a;letter-spacing:.3px">Alix Lasers ®</div>
  <div style="margin-top:8px">Mit freundlichen Grüßen</div>
  <div style="font-weight:600">${safeName}</div>
  <div style="margin-top:16px">
    <div style="font-weight:600">Alix Lasers International</div>
    <div>Web: <a href="https://www.alix-lasers.com" style="color:#b8860b;text-decoration:none">https://www.alix-lasers.com</a></div>
  </div>
  <hr style="margin:18px 0;border:none;border-top:1px solid #e5e5e5"/>
  <div style="font-size:11px;color:#666">
    <div style="font-weight:600;color:#333">Wichtiger Hinweis:</div>
    <p style="margin:4px 0 10px 0">Diese Nachricht (einschließlich aller Anhänge) ist vertraulich. Sollten Sie nicht der für diese E-Mail bestimmte Adressat sein, unterrichten Sie bitte den Absender und vernichten Sie diese Mail. Jede unerlaubte Nutzung oder Weitergabe des Inhalts dieser Nachricht, sei es vollständig oder teilweise, ist unzulässig. Für die Vollständigkeit oder Richtigkeit dieser Nachricht können wir keine Haftung übernehmen.</p>
    <div style="font-weight:600;color:#333">Important note:</div>
    <p style="margin:4px 0 0 0">This message (including any attachments) is confidential and may be privileged. If you are not the intended recipient of this e-mail please contact the sender and delete this message. Any unauthorized use or dissemination of this message in whole or in part is strictly prohibited. Please note that any views or opinions presented in this email are solely those of the author and do not necessarily represent those of the company.</p>
  </div>
</div>`.trim();
}

export function buildSignatureText(loginName: string): string {
  const name = loginName || "Alix Lasers Team";
  return `

--
Alix Lasers ®

Mit freundlichen Grüßen
${name}

Alix Lasers International
Web: https://www.alix-lasers.com

Wichtiger Hinweis:
Diese Nachricht (einschließlich aller Anhänge) ist vertraulich. Sollten Sie nicht der für diese E-Mail bestimmte Adressat sein, unterrichten Sie bitte den Absender und vernichten Sie diese Mail. Jede unerlaubte Nutzung oder Weitergabe des Inhalts dieser Nachricht, sei es vollständig oder teilweise, ist unzulässig. Für die Vollständigkeit oder Richtigkeit dieser Nachricht können wir keine Haftung übernehmen.

Important note:
This message (including any attachments) is confidential and may be privileged. If you are not the intended recipient of this e-mail please contact the sender and delete this message. Any unauthorized use or dissemination of this message in whole or in part is strictly prohibited.`;
}

export function appendSignature(
  html: string,
  text: string,
  loginName: string,
): { html: string; text: string } {
  const marker = "alix-signature-v1";
  const sigHtml = `<div data-sig="${marker}">${buildSignatureHtml(loginName)}</div>`;
  const sigText = buildSignatureText(loginName);
  const outHtml = html && html.includes(marker) ? html : (html || "") + sigHtml;
  const outText = text && text.includes("Alix Lasers ®") ? text : (text || "") + sigText;
  return { html: outHtml, text: outText };
}
