import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SlideViewerComponent, SlideViewerSlide } from './slide-viewer.component';

const DECK: SlideViewerSlide[] = [
  { src: '/files/1', thumbnailSrc: '/files/1/thumbnail', title: 'Welcome', kind: 'image' },
  { src: '/files/2', thumbnailSrc: '/files/2/thumbnail', title: 'Before we build', kind: 'image' },
  { src: '/files/3', thumbnailSrc: '/files/3/thumbnail', title: 'Three tracks', kind: 'image' },
];

@Component({
  imports: [SlideViewerComponent],
  template: `<ft-slide-viewer
    label="Slides"
    describedBy="slides-help"
    [slides]="slides()"
    [(index)]="index"
    [pdfMeta]="pdfMeta()"
  />`,
})
class HostComponent {
  slides = signal<SlideViewerSlide[]>(DECK);
  index = signal(0);
  pdfMeta = signal<string | null>(null);
}

function setup(slides: SlideViewerSlide[] = DECK) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.slides.set(slides);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const viewer = el.querySelector('ft-slide-viewer') as HTMLElement;
  const q = <T extends Element>(selector: string) => viewer.querySelector(selector) as T;
  const thumbs = () =>
    Array.from(viewer.querySelectorAll<HTMLButtonElement>('.ft-slide-viewer__thumb'));
  const button = (name: string) =>
    viewer.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  const key = (target: Element, k: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  const status = () =>
    q<HTMLElement>('.ft-slide-viewer__status').textContent!.replace(/\s+/g, ' ').trim();
  // Read as one sentence: "Slide 19 of 52, Three tracks".
  return { fixture, host: fixture.componentInstance, viewer, q, thumbs, button, key, status };
}

// docs/design-system/components/slide-viewer.html: the WAI-ARIA carousel pattern without rotation.
describe('SlideViewerComponent', () => {
  it('is a named carousel region the keyboard can reach, showing the current slide', () => {
    const { viewer, q } = setup();
    expect(viewer.getAttribute('role')).toBe('region');
    expect(viewer.getAttribute('aria-roledescription')).toBe('carousel');
    expect(viewer.getAttribute('aria-label')).toBe('Slides');
    expect(viewer.getAttribute('aria-describedby')).toBe('slides-help');
    expect(viewer.getAttribute('tabindex')).toBe('0');
    const stage = q<HTMLElement>('.ft-slide-viewer__stage');
    expect(stage.getAttribute('role')).toBe('group');
    expect(stage.getAttribute('aria-roledescription')).toBe('slide');
    expect(stage.getAttribute('aria-label')).toBe('1 of 3');
    const img = stage.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/files/1');
    expect(img.getAttribute('alt')).toBe('Slide 1: Welcome');
  });

  it('says where the person is in a polite live status', () => {
    const { q, status } = setup();
    const line = q<HTMLElement>('.ft-slide-viewer__status');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.getAttribute('aria-live')).toBe('polite');
    expect(line.getAttribute('aria-atomic')).toBe('true');
    expect(status()).toBe('Slide 1 of 3, Welcome');
  });

  it('moves with Previous and Next, disabling each at its end, and updates the bound index', () => {
    const { fixture, host, button, status } = setup();
    expect(button('Previous slide').disabled).toBe(true);
    expect(button('Next slide').disabled).toBe(false);

    button('Next slide').click();
    fixture.detectChanges();
    expect(host.index()).toBe(1);
    expect(status()).toBe('Slide 2 of 3, Before we build');
    expect(button('Previous slide').disabled).toBe(false);

    button('Next slide').click();
    fixture.detectChanges();
    expect(host.index()).toBe(2);
    expect(button('Next slide').disabled).toBe(true);

    button('Previous slide').click();
    fixture.detectChanges();
    expect(host.index()).toBe(1);
  });

  it('shows the slide the caller binds', () => {
    const { fixture, host, status } = setup();
    host.index.set(2);
    fixture.detectChanges();
    expect(status()).toBe('Slide 3 of 3, Three tracks');
  });

  it('moves with the arrow keys, Home and End on the viewer, never past either end', () => {
    const { viewer, host, key } = setup();
    key(viewer, 'ArrowLeft');
    expect(host.index()).toBe(0);
    key(viewer, 'ArrowRight');
    expect(host.index()).toBe(1);
    key(viewer, 'End');
    expect(host.index()).toBe(2);
    key(viewer, 'ArrowRight');
    expect(host.index()).toBe(2);
    key(viewer, 'ArrowLeft');
    expect(host.index()).toBe(1);
    key(viewer, 'Home');
    expect(host.index()).toBe(0);
  });

  it('moves focus to the viewer when the focused button becomes disabled', () => {
    const { fixture, viewer, button } = setup();
    button('Next slide').click();
    fixture.detectChanges();
    button('Next slide').focus();
    button('Next slide').click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(viewer);
  });

  it('offers thumbnails as one toolbar with the current slide as its only tab stop', () => {
    const { q, thumbs } = setup();
    const strip = q<HTMLElement>('.ft-slide-viewer__thumbs');
    expect(strip.getAttribute('role')).toBe('toolbar');
    expect(strip.getAttribute('aria-label')).toBe('Jump to a slide');
    const [first, second] = thumbs();
    expect(thumbs()).toHaveLength(3);
    expect(first.getAttribute('aria-label')).toBe('Slide 1: Welcome');
    expect(first.getAttribute('aria-current')).toBe('true');
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(second.getAttribute('aria-current')).toBeNull();
    expect(second.getAttribute('tabindex')).toBe('-1');
    expect(first.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(first.querySelector('img')?.getAttribute('src')).toBe('/files/1/thumbnail');
  });

  it('moves focus along the strip with the arrow keys without changing the slide, and shows the picked one', () => {
    const { fixture, host, thumbs, key } = setup();
    thumbs()[0].focus();
    key(thumbs()[0], 'ArrowRight');
    expect(document.activeElement).toBe(thumbs()[1]);
    expect(thumbs()[1].getAttribute('tabindex')).toBe('0');
    expect(thumbs()[0].getAttribute('tabindex')).toBe('-1');
    expect(host.index()).toBe(0);

    key(thumbs()[1], 'End');
    expect(document.activeElement).toBe(thumbs()[2]);

    thumbs()[2].click();
    fixture.detectChanges();
    expect(host.index()).toBe(2);
    expect(thumbs()[2].getAttribute('aria-current')).toBe('true');
  });

  it('moves one slide with a horizontal swipe on the stage, and ignores a small or vertical one', () => {
    const { fixture, host, q } = setup();
    const stage = q<HTMLElement>('.ft-slide-viewer__stage');
    const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
      stage.dispatchEvent(
        Object.assign(new Event('touchstart'), {
          changedTouches: [{ clientX: fromX, clientY: fromY }],
        }),
      );
      stage.dispatchEvent(
        Object.assign(new Event('touchend'), { changedTouches: [{ clientX: toX, clientY: toY }] }),
      );
      fixture.detectChanges();
    };
    swipe(300, 100);
    expect(host.index()).toBe(1);
    swipe(100, 300);
    expect(host.index()).toBe(0);
    swipe(300, 290);
    expect(host.index()).toBe(0);
    swipe(300, 200, 0, 400);
    expect(host.index()).toBe(0);
  });

  it('scrolls the current thumbnail into view inside the strip', () => {
    const { fixture, host, q, thumbs } = setup();
    const strip = q<HTMLElement>('.ft-slide-viewer__thumbs');
    const scrollTo = vi.fn();
    strip.scrollTo = scrollTo as unknown as typeof strip.scrollTo;
    Object.defineProperty(strip, 'clientWidth', { value: 200 });
    thumbs().forEach((t, i) => {
      Object.defineProperty(t, 'offsetLeft', { value: i * 100 });
      Object.defineProperty(t, 'offsetWidth', { value: 96 });
    });
    host.index.set(2);
    fixture.detectChanges();
    TestBed.tick();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 96 });
  });

  it('shows the title in place of a slide that fails to load', () => {
    const { fixture, q } = setup();
    q<HTMLImageElement>('.ft-slide-viewer__stage img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(q('.ft-slide-viewer__stage img')).toBeNull();
    expect(q('.ft-slide-viewer__fallback')?.textContent?.trim()).toBe('Welcome');
  });

  describe('a PDF', () => {
    const PDF: SlideViewerSlide = {
      src: '/files/9',
      thumbnailSrc: '/files/9/thumbnail',
      title: 'SoCal Hackathon slides',
      kind: 'pdf',
    };

    it('leaves out the bar and the thumbnails when the deck is one PDF, and links to it', () => {
      const { fixture, host, viewer, q } = setup([PDF]);
      host.pdfMeta.set('SoCal Hackathon slides · PDF · 18.4 MB');
      fixture.detectChanges();
      expect(viewer.classList).toContain('ft-slide-viewer--file');
      expect(viewer.getAttribute('tabindex')).toBeNull();
      expect(viewer.getAttribute('aria-roledescription')).toBeNull();
      expect(q('.ft-slide-viewer__bar')).toBeNull();
      expect(q('.ft-slide-viewer__thumbs')).toBeNull();
      const img = q<HTMLImageElement>('.ft-slide-viewer__stage img');
      expect(img.getAttribute('src')).toBe('/files/9/thumbnail');
      expect(img.getAttribute('alt')).toBe('First page of SoCal Hackathon slides');
      const link = q<HTMLAnchorElement>('a');
      expect(link.getAttribute('href')).toBe('/files/9');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
      expect(link.textContent).toContain('Open the slides (PDF)');
      expect(link.textContent).toContain('(new tab)');
      expect(q('.ft-slide-viewer__meta')?.textContent?.trim()).toBe(
        'SoCal Hackathon slides · PDF · 18.4 MB',
      );
    });

    it('shows its thumbnail and link at its place among image slides, with the bar and thumbnails', () => {
      const { fixture, host, q } = setup([DECK[0], PDF]);
      expect(q('a')).toBeNull();
      host.index.set(1);
      fixture.detectChanges();
      expect(q<HTMLImageElement>('.ft-slide-viewer__stage img').getAttribute('src')).toBe(
        '/files/9/thumbnail',
      );
      expect(q<HTMLAnchorElement>('a').getAttribute('href')).toBe('/files/9');
      expect(q('.ft-slide-viewer__bar')).not.toBeNull();
      expect(q('.ft-slide-viewer__thumbs')).not.toBeNull();
    });
  });

  it('leaves out the bar and the thumbnails for one slide', () => {
    const { q } = setup([DECK[0]]);
    expect(q('.ft-slide-viewer__bar')).toBeNull();
    expect(q('.ft-slide-viewer__thumbs')).toBeNull();
    expect(q('.ft-slide-viewer__stage img')?.getAttribute('alt')).toBe('Slide 1: Welcome');
  });
});
