import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventCardComponent, EventVisibility } from './event-card.component';

@Component({
  imports: [EventCardComponent],
  template: `<ul>
    <ft-event-card
      title="Toronto Builders Night"
      href="/events/toronto-builders-night"
      month="Nov"
      day="6"
      meta="Thu 6 Nov · 6:30 pm · Kestrel Labs, 220 King St W · 34 going"
      [visibility]="visibility()"
    />
  </ul>`,
})
class HostComponent {
  visibility = signal<EventVisibility>('public');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  return { fixture, cmp: fixture.componentInstance, host, q };
}

describe('EventCardComponent', () => {
  it('is a list item whose only focus stop is the title link', () => {
    const { host, q } = setup();
    expect(host.querySelector('ft-event-card')!.getAttribute('role')).toBe('listitem');
    const link = q<HTMLAnchorElement>('a');
    expect(link.getAttribute('href')).toBe('/events/toronto-builders-night');
    expect(link.textContent!.trim()).toBe('Toronto Builders Night');
    expect(host.querySelectorAll('a, button')).toHaveLength(1);
  });

  it('shows the date leaf hidden from assistive technology, with the date in the meta line', () => {
    const { q } = setup();
    const leaf = q('.ft-event-card__date');
    expect(leaf.getAttribute('aria-hidden')).toBe('true');
    expect(leaf.textContent).toContain('Nov');
    expect(leaf.textContent).toContain('6');
    expect(q('.ft-event-card__meta').textContent).toContain('Thu 6 Nov · 6:30 pm');
  });

  it.each([
    ['public', 'Public'],
    ['members', 'Members only'],
    ['cancelled', 'Cancelled'],
  ] as const)('says %s in words with a badge', (visibility, text) => {
    const { fixture, cmp, q } = setup();
    cmp.visibility.set(visibility);
    fixture.detectChanges();
    expect(q('ft-badge').textContent!.trim()).toBe(text);
  });

  it('uses the info, neutral and danger badge tints', () => {
    const { fixture, cmp, q } = setup();
    expect(q('.ft-badge').classList.contains('ft-badge--info')).toBe(true);
    cmp.visibility.set('members');
    fixture.detectChanges();
    expect(q('.ft-badge').classList.contains('ft-badge--neutral')).toBe(true);
    cmp.visibility.set('cancelled');
    fixture.detectChanges();
    expect(q('.ft-badge').classList.contains('ft-badge--danger')).toBe(true);
  });

  it('mutes a cancelled event but leaves its title a working link', () => {
    const { fixture, cmp, host, q } = setup();
    expect(host.querySelector('.ft-event-card--cancelled')).toBeNull();
    cmp.visibility.set('cancelled');
    fixture.detectChanges();
    expect(host.querySelector('.ft-event-card--cancelled')).not.toBeNull();
    expect(q('.ft-event-card__date').classList.contains('ft-event-card__date--cancelled')).toBe(
      true,
    );
    expect(q<HTMLAnchorElement>('a').getAttribute('href')).toBe('/events/toronto-builders-night');
  });
});
