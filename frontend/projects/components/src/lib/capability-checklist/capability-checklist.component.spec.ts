import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CapabilityChecklistComponent, ChecklistEntry } from './capability-checklist.component';

const ENTRIES: ChecklistEntry[] = [
  { value: 'ManageEvents', label: 'Manage events', description: 'Create, edit and cancel events.' },
  { value: 'ViewReports', label: 'View reports', description: 'Open the Reports page.' },
  {
    value: 'AdministerOrganisation',
    label: 'Administer the organisation',
    description: 'Do anything.',
    disabledReason: 'Only administrators can grant administration',
  },
];

@Component({
  imports: [ReactiveFormsModule, CapabilityChecklistComponent],
  template: `<ft-capability-checklist
    legend="Capabilities"
    [entries]="entries"
    [formControl]="chosen"
  />`,
})
class HostComponent {
  entries = ENTRIES;
  chosen = new FormControl<string[]>(['ViewReports'], { nonNullable: true });
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const box = (value: string) =>
    host.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${value}"]`)!;
  return { fixture, host, box };
}

describe('CapabilityChecklistComponent', () => {
  it('offers each entry under the legend with its description, checked from the value', () => {
    const { host, box } = setup();
    expect(host.querySelector('legend')?.textContent).toContain('Capabilities');
    expect(box('ManageEvents').closest('label')?.textContent).toContain(
      'Create, edit and cancel events.',
    );
    expect(box('ViewReports').checked).toBe(true);
    expect(box('ManageEvents').checked).toBe(false);
  });

  it('reports the checked entries in catalogue order', () => {
    const { fixture, box } = setup();
    box('ManageEvents').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.chosen.value).toEqual(['ManageEvents', 'ViewReports']);
  });

  it('disables an entry with a reason and reads the reason in place of its description', () => {
    const { box } = setup();
    const admin = box('AdministerOrganisation');
    expect(admin.disabled).toBe(true);
    expect(admin.closest('label')?.textContent).toContain(
      'Only administrators can grant administration',
    );
    expect(admin.closest('label')?.textContent).not.toContain('Do anything.');
  });

  it('disables every entry while the form is disabled', () => {
    const { fixture, box } = setup();
    fixture.componentInstance.chosen.disable();
    fixture.detectChanges();
    expect(box('ManageEvents').disabled).toBe(true);
  });
});
