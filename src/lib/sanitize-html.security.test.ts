import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize-html';

describe('untrusted shared HTML security', () => {
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