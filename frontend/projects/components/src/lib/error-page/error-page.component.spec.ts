import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorKind, ErrorPageComponent } from './error-page.component';

@Component({
  imports: [ErrorPageComponent],
  template: `<ft-error-page
    [kind]="kind()"
    [reference]="reference()"
    [retrying]="retrying()"
    (retry)="retried = retried + 1"
  />`,
})
class HostComponent {
  kind = signal<ErrorKind>('not-found');
  reference = signal<string | null>(null);
  retrying = signal(false);
  retried = 0;
}

function setup(kind: ErrorKind = 'not-found') {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.kind.set(kind);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, cmp: fixture.componentInstance };
}

describe('ErrorPageComponent', () => {
  it('not found: h1, home link and search link', () => {
    const { host } = setup('not-found');
    expect(host.querySelector('h1')?.textContent).toContain('find that page');
    const links = Array.from(host.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/search']);
    expect(links[0].textContent).toContain('Go home');
  });

  it('forbidden: explains missing access and offers home only', () => {
    const { host } = setup('forbidden');
    expect(host.querySelector('h1')?.textContent).toContain('access');
    expect(host.querySelectorAll('a').length).toBe(1);
    expect(host.querySelector('button')).toBeNull();
  });

  it('server error: shows the reference and a try again button that emits retry', () => {
    const { fixture, cmp, host } = setup('server-error');
    cmp.reference.set('7f3c-21a9-4b0e');
    fixture.detectChanges();
    expect(host.textContent).toContain('Reference: 7f3c-21a9-4b0e');
    host.querySelector('button')!.click();
    expect(cmp.retried).toBe(1);
  });

  it('offline: try again, no reference line', () => {
    const { host } = setup('offline');
    expect(host.querySelector('h1')?.textContent).toContain('offline');
    expect(host.querySelector('button')?.textContent).toContain('Try again');
    expect(host.textContent).not.toContain('Reference');
  });

  it('is busy while retrying and does not emit', () => {
    const { fixture, cmp, host } = setup('offline');
    cmp.retrying.set(true);
    fixture.detectChanges();
    const btn = host.querySelector('button')!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    btn.click();
    expect(cmp.retried).toBe(0);
  });

  it('keeps the icon circle decorative', () => {
    const { host } = setup('forbidden');
    expect(host.querySelector('.error-page__icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
