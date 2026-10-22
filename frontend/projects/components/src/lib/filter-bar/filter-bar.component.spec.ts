import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterBarComponent } from './filter-bar.component';

// Traces to: Reports filter row (docs/design-system/patterns/lists-and-tables.html, Report;
// components/chip.html, .filter-bar).
//
// Given the Reports filters, When the filter bar renders, Then it is a group named "Report
// filters" holding the City and Period fields and Apply in order, with Export CSV in the end
// slot after them.

@Component({
  imports: [FilterBarComponent],
  template: `<ft-filter-bar label="Report filters">
    <label for="city">City</label
    ><select id="city">
      <option>All cities</option>
    </select>
    <label for="period">Period</label
    ><select id="period">
      <option>Last 30 days</option>
    </select>
    <button type="submit">Apply</button>
    <button ftFilterBarEnd type="button">Export CSV</button>
  </ft-filter-bar>`,
})
class HostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host = (fixture.nativeElement as HTMLElement).querySelector('ft-filter-bar') as HTMLElement;
  return { fixture, host };
}

describe('FilterBarComponent', () => {
  it('is a group named by its label', () => {
    const { host } = setup();
    expect(host.getAttribute('role')).toBe('group');
    expect(host.getAttribute('aria-label')).toBe('Report filters');
  });

  it('projects the filters and Apply in order', () => {
    const { host } = setup();
    const filters = host.querySelector('.ft-filter-bar__filters')!;
    expect(filters.querySelectorAll('select').length).toBe(2);
    expect(filters.querySelector('button')?.textContent).toBe('Apply');
  });

  it('puts the end slot after the filters', () => {
    const { host } = setup();
    const end = host.querySelector('.ft-filter-bar__end')!;
    expect(end.textContent?.trim()).toBe('Export CSV');
    const filters = host.querySelector('.ft-filter-bar__filters')!;
    expect(filters.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filters.textContent).not.toContain('Export CSV');
  });
});
