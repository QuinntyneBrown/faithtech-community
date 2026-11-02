import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListComponent } from './list.component';
import { ListItemComponent } from './list-item.component';

@Component({
  imports: [ListComponent, ListItemComponent],
  template: `<ft-list [flush]="flush()" label="Contacts">
    <ft-list-item label="Tomas Ortega" href="/contacts/1" meta="Signed up today">
      <span leading class="lead">TO</span>
      <span trailing class="trail">Signed up</span>
    </ft-list-item>
    <ft-list-item label="nate@example.org" />
    <ft-list-item label="Grace Okonkwo"><span meta class="role">City Lead</span></ft-list-item>
  </ft-list>`,
})
class HostComponent {
  flush = signal(true);
}

@Component({
  imports: [ListComponent, ListItemComponent],
  template: `<ft-list label="Announcements">
    <ft-list-item label="Welcome" description="Team formation opens Monday." />
    <ft-list-item label="No text" />
  </ft-list>`,
})
class DescriptionHostComponent {}

@Component({
  imports: [ListComponent, ListItemComponent],
  template: `<ft-list label="Agenda">
    <ft-list-item label="Doors open" state="finished" />
    <ft-list-item label="Build time" state="current" />
    <ft-list-item label="Code freeze" />
  </ft-list>`,
})
class StateHostComponent {}

@Component({
  imports: [ListComponent, ListItemComponent],
  template: `<ft-list numbered label="Rules">
    <ft-list-item number="01" label="Start fresh" meta="The code starts today." />
    <ft-list-item number="02" label="Any stack" />
  </ft-list>`,
})
class NumberedHostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('ListComponent', () => {
  it('is a labelled list of list items', () => {
    const { el } = setup();
    const list = el.querySelector('ft-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('list');
    expect(list.getAttribute('aria-label')).toBe('Contacts');
    const items = el.querySelectorAll('ft-list-item');
    expect(items.length).toBe(3);
    expect(items[0].getAttribute('role')).toBe('listitem');
  });

  it('is flush by default and can drop the flush look', () => {
    const { fixture, cmp, el } = setup();
    const list = el.querySelector('ft-list') as HTMLElement;
    expect(list.classList.contains('ft-list--flush')).toBe(true);
    cmp.flush.set(false);
    fixture.detectChanges();
    expect(list.classList.contains('ft-list--flush')).toBe(false);
  });
});

describe('ListComponent numbered', () => {
  // docs/design-system/components/list.html#numbered: ft-list numbered renders an <ol>; each row leads with its number.
  function setupNumbered() {
    const fixture = TestBed.createComponent(NumberedHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an ordered list named by the label, holding the rows', () => {
    const el = setupNumbered();
    const host = el.querySelector('ft-list') as HTMLElement;
    const ol = host.querySelector('ol') as HTMLOListElement;
    expect(ol).not.toBeNull();
    expect(ol.getAttribute('aria-label')).toBe('Rules');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('aria-label')).toBeNull();
    expect(ol.querySelectorAll('ft-list-item[role="listitem"]').length).toBe(2);
  });

  it('leads each row with its number, hidden from assistive technology', () => {
    const el = setupNumbered();
    const numbers = Array.from(el.querySelectorAll('.ft-list-item__number'));
    expect(numbers.map((n) => n.textContent?.trim())).toEqual(['01', '02']);
    expect(numbers.every((n) => n.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(el.querySelector('ft-list-item')?.classList).toContain('ft-list-item--numbered');
  });

  it('renders no ordered list and no number by default', () => {
    const { el } = setup();
    expect(el.querySelector('ol')).toBeNull();
    expect(el.querySelector('.ft-list-item__number')).toBeNull();
  });
});

describe('ListItemComponent', () => {
  // docs/design-system/components/list.html, Row states: a highlighted current row and a muted finished row.
  it('shows a row as current or finished, and plain by default', () => {
    const fixture = TestBed.createComponent(StateHostComponent);
    fixture.detectChanges();
    const [finished, current, plain] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('ft-list-item'),
    );
    expect(finished.classList).toContain('ft-list-item--finished');
    expect(current.classList).toContain('ft-list-item--current');
    expect(plain.className).not.toMatch(/--current|--finished/);
  });

  it('renders a link when href is set and plain text otherwise', () => {
    const { el } = setup();
    const items = el.querySelectorAll('ft-list-item');
    const a = items[0].querySelector('a.ft-list-item__title') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/contacts/1');
    expect(a.textContent).toBe('Tomas Ortega');
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[1].querySelector('.ft-list-item__title')?.textContent).toBe('nate@example.org');
  });

  it('shows meta and projects leading and trailing slots', () => {
    const { el } = setup();
    const item = el.querySelector('ft-list-item') as HTMLElement;
    expect(item.querySelector('.ft-list-item__meta')?.textContent).toBe('Signed up today');
    expect(item.querySelector('.ft-list-item__leading .lead')).not.toBeNull();
    expect(item.querySelector('.ft-list-item__trailing .trail')).not.toBeNull();
  });

  it('projects rich meta, such as role badges, into the meta line', () => {
    const { el } = setup();
    const item = el.querySelectorAll('ft-list-item')[2];
    expect(item.querySelector('.ft-list-item__meta-slot .role')?.textContent).toBe('City Lead');
  });

  it('marks rows with a title link as interactive so they tint on hover', () => {
    const { el } = setup();
    const items = el.querySelectorAll('ft-list-item');
    expect(items[0].classList.contains('ft-list-item--link')).toBe(true);
    expect(items[1].classList.contains('ft-list-item--link')).toBe(false);
  });

  it('omits meta when not given', () => {
    const { el } = setup();
    const item = el.querySelectorAll('ft-list-item')[1];
    expect(item.querySelector('.ft-list-item__meta:not(.ft-list-item__meta-slot)')).toBeNull();
    expect(item.querySelector('.ft-list-item__meta-slot')?.childNodes.length).toBe(0);
  });

  it('shows a description under the meta line, in body text, only when given', () => {
    const fixture = TestBed.createComponent(DescriptionHostComponent);
    fixture.detectChanges();
    const descriptions = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.ft-list-item__description',
    );
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0].textContent!.trim()).toBe('Team formation opens Monday.');
  });
});
