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
  </ft-list>`,
})
class HostComponent {
  flush = signal(true);
}

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
    expect(items.length).toBe(2);
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

describe('ListItemComponent', () => {
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

  it('omits meta when not given', () => {
    const { el } = setup();
    expect(el.querySelectorAll('ft-list-item')[1].querySelector('.ft-list-item__meta')).toBeNull();
  });
});
