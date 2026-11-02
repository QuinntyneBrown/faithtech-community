import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent, CardVariant } from './card.component';

@Component({
  imports: [CardComponent],
  template: `<ft-card
    [variant]="variant()"
    [heading]="heading()"
    [headingLevel]="level()"
    [busy]="busy()"
    ><button ftCardActions type="button">Add members</button>
    <p class="inner">Body</p></ft-card
  >`,
})
class HostComponent {
  variant = signal<CardVariant>('plain');
  heading = signal<string | null>('Recent activity');
  level = signal<2 | 3 | 4>(2);
  busy = signal(false);
}

@Component({
  imports: [CardComponent],
  template: `<ft-card
    variant="media"
    heading="On site · 75 spots"
    [headingLevel]="3"
    [mediaSrc]="src()"
    mediaAlt="Map of on-site parking"
    ><p class="inner">Lot A is tandem parking.</p></ft-card
  >`,
})
class MediaHostComponent {
  src = signal<string | null>('/hub/files/1/thumbnail');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const card = () => fixture.nativeElement.querySelector('ft-card') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, card };
}

describe('CardComponent', () => {
  it('projects its content', () => {
    const { card } = setup();
    expect(card().querySelector('.inner')?.textContent).toBe('Body');
  });

  it('renders the heading as a real heading that names the region', () => {
    const { card } = setup();
    const h = card().querySelector('h2') as HTMLElement;
    expect(h.textContent).toContain('Recent activity');
    expect(card().getAttribute('role')).toBe('region');
    expect(card().getAttribute('aria-labelledby')).toBe(h.id);
  });

  it('honours the heading level', () => {
    const { fixture, cmp, card } = setup();
    cmp.level.set(3);
    fixture.detectChanges();
    expect(card().querySelector('h3')).not.toBeNull();
    expect(card().querySelector('h2')).toBeNull();
  });

  it('puts a header action beside the title', () => {
    const { card } = setup();
    const header = card().querySelector('.ft-card__header')!;
    expect(header.querySelector('h2')!.textContent).toContain('Recent activity');
    expect(header.querySelector('button')!.textContent).toContain('Add members');
  });

  it('has no landmark role without a heading', () => {
    const { fixture, cmp, card } = setup();
    cmp.heading.set(null);
    fixture.detectChanges();
    expect(card().getAttribute('role')).toBeNull();
    expect(card().querySelector('h2')).toBeNull();
  });

  it.each(['plain', 'flush', 'strip', 'success'] as const)('applies the %s variant', (v) => {
    const { fixture, cmp, card } = setup();
    cmp.variant.set(v);
    fixture.detectChanges();
    expect(card().classList.contains(`ft-card--${v}`)).toBe(true);
  });

  it('announces a success card as status', () => {
    const { fixture, cmp, card } = setup();
    cmp.variant.set('success');
    fixture.detectChanges();
    expect(card().getAttribute('role')).toBe('status');
  });

  it('marks itself busy while loading', () => {
    const { fixture, cmp, card } = setup();
    expect(card().getAttribute('aria-busy')).toBeNull();
    cmp.busy.set(true);
    fixture.detectChanges();
    expect(card().getAttribute('aria-busy')).toBe('true');
  });

  // docs/design-system/components/card.html#card-v-media: a flush card that leads with an image above a padded body.
  describe('media variant', () => {
    function setupMedia() {
      const fixture = TestBed.createComponent(MediaHostComponent);
      fixture.detectChanges();
      return { fixture, card: fixture.nativeElement.querySelector('ft-card') as HTMLElement };
    }

    it('leads with the image, described by its alt text, above the body', () => {
      const { card } = setupMedia();
      expect(card.classList).toContain('ft-card--media');
      const img = card.firstElementChild as HTMLImageElement;
      expect(img.tagName).toBe('IMG');
      expect(img.classList).toContain('ft-card__media');
      expect(img.getAttribute('src')).toBe('/hub/files/1/thumbnail');
      expect(img.getAttribute('alt')).toBe('Map of on-site parking');
    });

    it('puts the heading and the content in the padded body', () => {
      const { card } = setupMedia();
      const body = card.querySelector('.ft-card__body') as HTMLElement;
      expect(body.querySelector('h3')?.textContent).toContain('On site · 75 spots');
      expect(body.querySelector('.inner')?.textContent).toBe('Lot A is tandem parking.');
      expect(card.getAttribute('role')).toBe('region');
    });

    it('leaves the image out when there is none', () => {
      const { fixture, card } = setupMedia();
      fixture.componentInstance.src.set(null);
      fixture.detectChanges();
      expect(card.querySelector('img')).toBeNull();
      expect(card.querySelector('.ft-card__body .inner')).not.toBeNull();
    });
  });
});
