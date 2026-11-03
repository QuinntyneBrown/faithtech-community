import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Page } from '@playwright/test';

const REPO = join(__dirname, '..', '..');
const css = (...path: string[]) => readFileSync(join(REPO, ...path), 'utf8');

/** An email as the fake API queued it. */
export interface PreviewEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The HTML part as EmailTemplateRenderer builds it from the plain-text body (backend Infrastructure/Email):
 * a paragraph that is only a URL is the "Open in {short name}" button, a line "Label: URL" is a link named
 * Label, and the footer names the organisation and the one kind of email that can be turned off.
 */
function html(email: PreviewEmail, organisation: string, shortName: string): string {
  const paragraphs = email.body
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (/^https:\/\/\S+$/.test(p)) {
        return `<p class="email__action"><a class="email__button" href="${escape(p)}">Open in ${escape(shortName)}</a></p>`;
      }
      const lines = p.split('\n').map((line) => {
        const labelled = /^(.+?):\s+(https:\/\/\S+)$/.exec(line);
        return labelled
          ? `<a href="${escape(labelled[2])}">${escape(labelled[1])}</a>`
          : escape(line);
      });
      return `<p class="email__text">${lines.join('<br>')}</p>`;
    })
    .join('');
  return (
    `<div class="email" data-theme="light"><p class="email__title">${escape(email.subject)}</p>${paragraphs}` +
    `<p class="email__footer">${escape(organisation)} · You can turn off announcement emails in Settings; ` +
    `account and activity emails are always sent.</p></div>`
  );
}

/**
 * Shows a queued email the way the mail mocks do (docs/mocks/notifications/email/success.html): the From, To and
 * Subject card above the message. The recording has no mail server, so this stands in for the inbox.
 */
export async function showEmail(
  page: Page,
  email: PreviewEmail,
  organisation = 'FaithTech Community',
  shortName = 'FaithTech',
): Promise<void> {
  const styles = [
    css('docs', 'design-system', 'tokens', 'tokens.css'),
    css('docs', 'design-system', 'assets', 'components.css'),
    css('docs', 'mocks', 'assets', 'mock.css'),
  ].join('\n');
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(email.subject)}</title>` +
      `<style>${styles}</style></head><body><main class="container mail-page">` +
      `<dl class="mail-meta card"><div><dt>From</dt><dd>${escape(email.from)}</dd></div>` +
      `<div><dt>To</dt><dd>${escape(email.to)}</dd></div>` +
      `<div><dt>Subject</dt><dd>${escape(email.subject)}</dd></div></dl>` +
      `<div class="mail-preview">${html(email, organisation, shortName)}</div></main></body></html>`,
  );
}
