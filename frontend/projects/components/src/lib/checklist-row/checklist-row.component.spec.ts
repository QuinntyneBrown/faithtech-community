import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChecklistRowComponent, ChecklistRowState } from './checklist-row.component';

@Component({
  imports: [ChecklistRowComponent],
  template: `<div role="list">
    <ft-checklist-row label="Agenda" description="The day’s schedule." [state]="state()">
      <button actions type="button">Fill in</button>
    </ft-checklist-row>
  </div>`,
})
class HostComponent {
  state = signal<ChecklistRowState>('needs-info');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const row = () => el.querySelector('ft-checklist-row') as HTMLElement;
  const badge = () => row().querySelector('ft-badge') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, row, badge };
}

// Traces to: L2-154 AC1, AC2 (components/checklist-row.html).
describe('ChecklistRowComponent', () => {
  it('is a list item with its title, one line and actions', () => {
    const { row } = setup();
    expect(row().getAttribute('role')).toBe('listitem');
    expect(row().querySelector('.ft-checklist-row__title')?.textContent?.trim()).toBe('Agenda');
    expect(row().querySelector('.ft-checklist-row__text')?.textContent?.trim()).toBe(
      'The day’s schedule.',
    );
    expect(row().querySelector('button')?.textContent?.trim()).toBe('Fill in');
  });

  it('says Needs info with a warning badge', () => {
    const { row, badge } = setup();
    expect(badge().textContent?.trim()).toBe('Needs info');
    expect(row().classList).toContain('ft-checklist-row--needs-info');
  });

  it('says Ready and Hidden, muting a hidden row', () => {
    const { fixture, cmp, row, badge } = setup();
    cmp.state.set('ready');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Ready');
    expect(row().classList).toContain('ft-checklist-row--ready');
    cmp.state.set('hidden');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Hidden');
    expect(row().classList).toContain('ft-checklist-row--hidden');
  });
});
