import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreadcrumbItemComponent } from './breadcrumb-item.component';
import { BreadcrumbComponent } from './breadcrumb.component';

@Component({
  imports: [BreadcrumbComponent, BreadcrumbItemComponent],
  template: `<ft-breadcrumb>
    <ft-breadcrumb-item href="/contacts">Contacts</ft-breadcrumb-item>
    <ft-breadcrumb-item>Archived contacts</ft-breadcrumb-item>
  </ft-breadcrumb>`,
})
class HostComponent {}

describe('BreadcrumbComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a nav labelled Breadcrumb holding an ordered list', () => {
    const nav = setup().querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(nav.querySelector('ol')).toBeTruthy();
  });

  it('renders ancestors as links', () => {
    const link = setup().querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/contacts');
    expect(link.textContent).toContain('Contacts');
  });

  it('renders the last item as plain text with aria-current page', () => {
    const items = setup().querySelectorAll('ft-breadcrumb-item');
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[1].getAttribute('aria-current')).toBe('page');
    expect(items[0].getAttribute('aria-current')).toBeNull();
  });

  it('gives each item the listitem role inside the list', () => {
    const items = setup().querySelectorAll('ft-breadcrumb-item');
    expect(items[0].getAttribute('role')).toBe('listitem');
  });
});
