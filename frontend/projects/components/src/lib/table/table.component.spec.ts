import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TableColumn, TableComponent } from './table.component';

@Component({
  imports: [TableComponent],
  template: `
    <ng-template #status let-row>[{{ row.status }}]</ng-template>
    <ft-table caption="Audit log" [columns]="columns()" [rows]="rows()" [busy]="busy()" />
  `,
})
class HostComponent {
  status = viewChild.required<TemplateRef<unknown>>('status');
  busy = signal(false);
  rows = signal<Record<string, unknown>[]>([
    { when: '2026-10-21 10:05', who: 'Priya Shah', status: 'ok' },
    { when: '2026-10-20 16:44', who: 'Priya Shah', status: 'bad' },
  ]);
  columns = signal<TableColumn[]>([
    { key: 'when', header: 'When', mono: true },
    { key: 'who', header: 'Who' },
    { key: 'status', header: 'Status' },
  ]);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('TableComponent', () => {
  it('renders a native table with a visually hidden caption', () => {
    const { el } = setup();
    const cap = el.querySelector('table caption') as HTMLElement;
    expect(cap.textContent).toBe('Audit log');
    expect(cap.classList.contains('ft-table__caption')).toBe(true);
  });

  it('renders column headers with col scope', () => {
    const { el } = setup();
    const ths = Array.from(el.querySelectorAll('thead th'));
    expect(ths.map((t) => t.textContent?.trim())).toEqual(['When', 'Who', 'Status']);
    expect(ths.every((t) => t.getAttribute('scope') === 'col')).toBe(true);
  });

  it('renders one row per item with cell values', () => {
    const { el } = setup();
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelectorAll('td')[1].textContent?.trim()).toBe('Priya Shah');
  });

  it('uses the mono style for mono columns', () => {
    const { el } = setup();
    expect(el.querySelector('tbody td')?.classList.contains('ft-table__mono')).toBe(true);
  });

  it('hides a header visually but keeps it for assistive tech', () => {
    const { fixture, cmp, el } = setup();
    cmp.columns.set([{ key: 'who', header: 'Actions', hideHeader: true }]);
    fixture.detectChanges();
    const th = el.querySelector('thead th') as HTMLElement;
    expect(th.querySelector('.ft-table__visually-hidden')?.textContent).toBe('Actions');
  });

  it('renders a cell template for a column', () => {
    const { fixture, cmp, el } = setup();
    cmp.columns.set([{ key: 'status', header: 'Status', template: cmp.status() }]);
    fixture.detectChanges();
    expect(el.querySelector('tbody td')?.textContent).toContain('[ok]');
  });

  it('marks itself busy while loading', () => {
    const { fixture, cmp, el } = setup();
    cmp.busy.set(true);
    fixture.detectChanges();
    expect(el.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
  });

  it('lets a wide table scroll inside its wrapper', () => {
    const { el } = setup();
    expect(el.querySelector('.ft-table__wrap')).not.toBeNull();
  });
});
