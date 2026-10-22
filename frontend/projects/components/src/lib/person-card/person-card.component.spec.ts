import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BadgeComponent } from '../badge/badge.component';
import { PersonCardComponent } from './person-card.component';
import { PersonGridComponent } from './person-grid.component';
import { PersonCardSkeletonComponent } from './person-card-skeleton.component';

@Component({
  imports: [PersonGridComponent, PersonCardComponent, BadgeComponent, PersonCardSkeletonComponent],
  template: `<ft-person-grid label="Contacts">
    <ft-person-card
      name="Tomás Ortega"
      [photoSrc]="photo()"
      photoAlt="Tomás smiling outside Harbour Light Shelter"
      color="sun"
      subtitle="Harbour Light Shelter · Toronto"
      secondary="2 notes"
      href="/contacts/c1"
      dismissLabel="Archive Tomás Ortega"
      (dismissed)="dismissed = dismissed + 1"
    >
      <ft-badge badge variant="success">Signed up</ft-badge>
    </ft-person-card>
    <ft-person-card name="Kwame Asante" href="/contacts/c2" />
  </ft-person-grid>`,
})
class HostComponent {
  photo = signal<string | null>('blob:tomas');
  dismissed = 0;
}

function setup() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const cards = () => Array.from(host.querySelectorAll<HTMLElement>('article'));
  return { fixture, cmp: fixture.componentInstance, host, cards };
}

describe('PersonCardComponent', () => {
  it('is a labelled list of articles, each named by its heading', () => {
    const { host, cards } = setup();
    const list = host.querySelector('ul')!;
    expect(list.getAttribute('aria-label')).toBe('Contacts');
    expect(host.querySelectorAll('ft-person-card[role="listitem"]')).toHaveLength(2);
    const [tomas] = cards();
    const heading = tomas.querySelector('h2')!;
    expect(tomas.getAttribute('aria-labelledby')).toBe(heading.querySelector('span')!.id);
    expect(heading.textContent).toContain('Tomás Ortega');
    expect(heading.textContent).toContain('Signed up');
  });

  it('shows the photo with its description, or the initials when there is none', () => {
    const { fixture, cmp, cards } = setup();
    const [tomas, kwame] = cards();
    const img = tomas.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('blob:tomas');
    expect(img.getAttribute('alt')).toBe('Tomás smiling outside Harbour Light Shelter');
    expect(kwame.querySelector('img')).toBeNull();
    expect(kwame.querySelector('.ft-person-card__initials')!.textContent!.trim()).toBe('KA');
    expect(
      kwame.querySelector('.ft-person-card__initials [aria-hidden="true"]')!.textContent!.trim(),
    ).toBe('KA');

    cmp.photo.set(null);
    fixture.detectChanges();
    expect(tomas.querySelector('img')).toBeNull();
  });

  it('falls back to the initials when the photo fails to load', () => {
    const { fixture, cards } = setup();
    const [tomas] = cards();
    tomas.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(tomas.querySelector('img')).toBeNull();
  });

  it('shows the subtitle and secondary line, and leaves out empty ones', () => {
    const { cards } = setup();
    const [tomas, kwame] = cards();
    expect(tomas.querySelector('.ft-person-card__subtitle')!.textContent!.trim()).toBe(
      'Harbour Light Shelter · Toronto',
    );
    expect(tomas.querySelector('.ft-person-card__secondary')!.textContent!.trim()).toBe('2 notes');
    expect(kwame.querySelector('.ft-person-card__subtitle')).toBeNull();
    expect(kwame.querySelector('.ft-person-card__secondary')).toBeNull();
  });

  it('links View profile, named with the person, and offers no connect action', () => {
    const { cards } = setup();
    const [tomas] = cards();
    const link = tomas.querySelector<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe('/contacts/c1');
    expect(link.textContent!.replace(/\s+/g, ' ').trim()).toBe('View profile Tomás Ortega');
    expect(tomas.textContent).not.toMatch(/connect|follow/i);
  });

  it('puts View profile before the dismiss button and emits when the dismiss button is pressed', () => {
    const { cmp, cards } = setup();
    const [tomas, kwame] = cards();
    const focusables = Array.from(tomas.querySelectorAll<HTMLElement>('a, button'));
    expect(focusables.map((el) => el.tagName)).toEqual(['A', 'BUTTON']);
    const dismiss = focusables[1] as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('Archive Tomás Ortega');
    expect(dismiss.type).toBe('button');
    dismiss.click();
    expect(cmp.dismissed).toBe(1);
    expect(kwame.querySelector('button')).toBeNull();
  });

  it('tints the cover with the person colour and hides it from assistive technology', () => {
    const { cards } = setup();
    const [tomas, kwame] = cards();
    expect(tomas.classList.contains('ft-person-card--sun')).toBe(true);
    expect(kwame.classList.contains('ft-person-card--plain')).toBe(true);
    expect(tomas.querySelector('.ft-person-card__cover')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('PersonCardSkeletonComponent', () => {
  it('is a busy status region with card-shaped placeholders hidden from assistive technology', () => {
    @Component({
      imports: [PersonCardSkeletonComponent],
      template: `<ft-person-card-skeleton label="Loading contacts" [cards]="3" />`,
    })
    class SkeletonHostComponent {}
    const fixture = TestBed.createComponent(SkeletonHostComponent);
    fixture.detectChanges();
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-label')).toBe('Loading contacts');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.querySelectorAll('.ft-person-card--loading')).toHaveLength(3);
    expect(status.querySelector('ul')!.getAttribute('aria-hidden')).toBe('true');
  });
});
