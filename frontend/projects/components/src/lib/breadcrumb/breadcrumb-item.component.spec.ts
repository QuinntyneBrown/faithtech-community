import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreadcrumbItemComponent } from './breadcrumb-item.component';

@Component({
  imports: [BreadcrumbItemComponent],
  template: `<ft-breadcrumb-item href="/events">Events</ft-breadcrumb-item>`,
})
class HostComponent {}

describe('BreadcrumbItemComponent', () => {
  it('links to its href when one is given', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const a = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/events');
    expect(a.textContent).toContain('Events');
  });
});
