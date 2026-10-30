import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressChartComponent, ProgressChartRow } from './progress-chart.component';

// Traces to: Reports bar charts (docs/detailed-designs/reports/reports-dashboard,
// docs/design-system/components/progress.html, Bar chart).
//
// Given a bar chart of members by city,
// When it renders, Then it is a list named by the chart's heading whose rows carry the category
// and the value as text, each track is aria-hidden (it is not a progressbar) and each fill is the
// value divided by the largest value.
// When it is loading, Then it keeps the named list busy with skeleton rows.

@Component({
  imports: [ProgressChartComponent],
  template: `<ft-progress-chart [rows]="rows()" [label]="label()" [loading]="loading()" />`,
})
class HostComponent {
  rows = signal<readonly ProgressChartRow[]>([
    { label: 'Toronto', value: 186 },
    { label: 'Austin', value: 97 },
    { label: 'Other', value: 24 },
  ]);
  label = signal('Members by city');
  loading = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const list = () => host.querySelector('ul') as HTMLUListElement;
  const rows = () => Array.from(host.querySelectorAll('li'));
  const rowText = (row: Element) =>
    Array.from(row.querySelectorAll('.ft-progress-chart__label'))
      .map((s) => s.textContent?.trim())
      .join(' ');
  const fills = () =>
    Array.from(host.querySelectorAll<HTMLElement>('.ft-progress-chart__bar')).map((b) =>
      b.style.getPropertyValue('--value'),
    );
  return { fixture, cmp: fixture.componentInstance, host, list, rows, rowText, fills };
}

describe('ProgressChartComponent', () => {
  it('is a list named by the chart', () => {
    const { list } = setup();
    expect(list().getAttribute('aria-label')).toBe('Members by city');
    expect(list().hasAttribute('aria-busy')).toBe(false);
  });

  it('gives each row its category and value as visible text', () => {
    const { rows, rowText } = setup();
    expect(rows().map(rowText)).toEqual(['Toronto 186', 'Austin 97', 'Other 24']);
  });

  it('hides every track from assistive technology and never uses a progressbar', () => {
    const { host } = setup();
    const tracks = host.querySelectorAll('.ft-progress-chart__track');
    expect(tracks.length).toBe(3);
    tracks.forEach((t) => expect(t.getAttribute('aria-hidden')).toBe('true'));
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('scales each bar to the largest value', () => {
    const { fills } = setup();
    expect(fills()).toEqual(['100%', '52%', '13%']);
  });

  it('shows a lone row as a full bar', () => {
    const { fixture, cmp, fills } = setup();
    cmp.rows.set([{ label: 'Toronto', value: 186 }]);
    fixture.detectChanges();
    expect(fills()).toEqual(['100%']);
  });

  it('shows empty tracks when every value is zero', () => {
    const { fixture, cmp, fills } = setup();
    cmp.rows.set([
      { label: 'Toronto', value: 0 },
      { label: 'Austin', value: 0 },
    ]);
    fixture.detectChanges();
    expect(fills()).toEqual(['0%', '0%']);
  });

  it('shows the value text when one is given', () => {
    const { fixture, cmp, rows, rowText } = setup();
    cmp.rows.set([{ label: 'Oct', value: 12, valueText: '12 so far' }]);
    fixture.detectChanges();
    expect(rowText(rows()[0])).toBe('Oct 12 so far');
  });

  it('keeps the named list busy with skeleton rows while loading', () => {
    const { fixture, cmp, host, list, rows } = setup();
    cmp.loading.set(true);
    fixture.detectChanges();
    expect(list().getAttribute('aria-busy')).toBe('true');
    expect(list().getAttribute('aria-label')).toBe('Members by city');
    expect(rows().length).toBe(5);
    expect(host.querySelectorAll('ft-skeleton').length).toBeGreaterThan(0);
    expect(host.textContent?.trim()).toBe('');
  });
});
