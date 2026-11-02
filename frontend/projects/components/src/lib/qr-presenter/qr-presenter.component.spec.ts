// Traces to: L2-194 (docs/design-system/components/qr-presenter.html)
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QrPresenterComponent, QrPresenterNote } from './qr-presenter.component';

@Component({
  imports: [QrPresenterComponent],
  template: `<ft-qr-presenter
    value="https://community.faithtech.example/public/events/e1/hub"
    alt="QR code for the Toronto Builders Night hub"
    heading="Toronto Builders Night"
    lead="Scan with a phone camera to open the hub"
    [note]="note()"
    (closed)="closed = closed + 1"
  />`,
})
class HostComponent {
  note = signal<QrPresenterNote | null>(null);
  closed = 0;
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, cmp: fixture.componentInstance };
}

describe('QrPresenterComponent', () => {
  let requested: ReturnType<typeof vi.fn>;
  let exited: ReturnType<typeof vi.fn>;
  let fullscreenElement: Element | null;

  beforeEach(() => {
    fullscreenElement = null;
    requested = vi.fn(() => {
      fullscreenElement = document.documentElement;
      return Promise.resolve();
    });
    exited = vi.fn(() => {
      fullscreenElement = null;
      return Promise.resolve();
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requested,
    });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exited });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
  });

  it('shows the title, lead, a fill-size code with its alt text, the link as text and the hint', () => {
    const { host } = setup();
    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Toronto Builders Night');
    expect(host.textContent).toContain('Scan with a phone camera to open the hub');
    expect(host.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(
      'QR code for the Toronto Builders Night hub',
    );
    expect(host.querySelector('figure')?.classList).toContain('ft-qr-code--fill');
    expect(host.textContent).toContain('https://community.faithtech.example/public/events/e1/hub');
    expect(host.textContent).toContain('Press Esc to close');
    expect(host.querySelector('ft-alert')).toBeNull();
  });

  it('shows a note when given one', () => {
    const { fixture, host, cmp } = setup();
    cmp.note.set({ heading: 'Your hub is a draft', text: 'Only managers can open it.' });
    fixture.detectChanges();
    expect(host.querySelector('ft-alert')?.textContent).toContain('Your hub is a draft');
  });

  it('asks for full screen, and Close full screen emits closed and leaves it when destroyed', async () => {
    const { fixture, host, cmp } = setup();
    await tick();
    expect(requested).toHaveBeenCalled();

    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(cmp.closed).toBe(1);
    fixture.destroy();
    expect(exited).toHaveBeenCalled();
  });

  it('emits closed when the browser leaves full screen by itself', async () => {
    const { cmp } = setup();
    await tick();
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(cmp.closed).toBe(1);
  });

  it('still shows the view when the browser refuses full screen', async () => {
    requested.mockImplementation(() => Promise.reject(new Error('denied')));
    const { host, cmp } = setup();
    await tick();
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(cmp.closed).toBe(0);
    expect(host.querySelector('svg[role="img"]')).not.toBeNull();
  });
});
