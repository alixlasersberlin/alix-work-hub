import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeHtml } from './sanitize-html';

describe('untrusted shared HTML security', () => {
  it('stored print fields remain literal text instead of executable elements', () => {
    const attack = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const container = document.createElement('div');
    container.innerHTML = `<table><tbody><tr><td>${escapeHtml(attack)}</td></tr></tbody></table>`;
    expect(container.querySelector('img,script,[onerror]')).toBeNull();
    expect(container.querySelector('td')?.textContent).toBe(attack);
  });
  it('invoice titles cannot escape the title element', () => {
    const attack = '</title><img src=x onerror=alert(1)>';
    const doc = new DOMParser().parseFromString(`<title>${escapeHtml(attack)}</title><p>ready</p>`, 'text/html');
    expect(doc.title).toBe(attack);
    expect(doc.querySelector('img')).toBeNull();
    expect(escapeHtml('Müller & Söhne "A"')).toBe('Müller &amp; Söhne &quot;A&quot;');
  });
  it('removes executable handlers from stored document and catalog payloads', () => {
    const container = document.createElement('div');
    container.innerHTML = sanitizeHtml('<img src="invalid" onerror="window.securityAttack=true"><svg onload="window.securityAttack=true"></svg>');
    expect(container.querySelector('[onerror],[onload]')).toBeNull();
  });
  it('rejects script navigation and embedded browsing contexts', () => {
    const container = document.createElement('div');
    container.innerHTML = sanitizeHtml('<a href="javascript:alert(document.cookie)">open</a><iframe srcdoc="<script>alert(1)</script>"></iframe><object data="data:text/html,test"></object>');
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(container.querySelector('iframe,object,script')).toBeNull();
  });
});