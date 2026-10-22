import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QrCodeComponent, QrCodeSize } from './qr-code.component';

@Component({
  imports: [QrCodeComponent],
  template: `<ft-qr-code
    [value]="value()"
    alt="QR code for your connect link"
    [size]="size()"
    [caption]="caption()"
    [busy]="busy()"
  />`,
})
class HostComponent {
  value = signal('https://community.faithtech.example/meet/abc');
  size = signal<QrCodeSize>('md');
  caption = signal<string | null>(null);
  busy = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('QrCodeComponent', () => {
  it('draws the value as one image named by its alt text', () => {
    const { q } = setup();
    const svg = q<SVGElement>('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('QR code for your connect link');
    // A version 4 code (33 modules) holds a 46-character URL at error correction M.
    expect(svg.getAttribute('viewBox')).toBe('0 0 33 33');
    expect(q('path').getAttribute('d')).toMatch(/^M0 0h7v1h-7z/);
  });

  it('redraws when the value changes', () => {
    const { fixture, cmp, q } = setup();
    const before = q('path').getAttribute('d');
    cmp.value.set('https://community.faithtech.example/meet/xyz');
    fixture.detectChanges();
    expect(q('path').getAttribute('d')).not.toBe(before);
  });

  it('shows the size, an optional caption and the busy state', () => {
    const { fixture, cmp, q } = setup();
    expect(q('figcaption')).toBeNull();
    cmp.size.set('lg');
    cmp.caption.set('Scan with a phone camera');
    cmp.busy.set(true);
    fixture.detectChanges();
    expect(q('figure').classList).toContain('ft-qr-code--lg');
    expect(q('figure').classList).toContain('ft-qr-code--busy');
    expect(q('figcaption').textContent).toBe('Scan with a phone camera');
  });
});
