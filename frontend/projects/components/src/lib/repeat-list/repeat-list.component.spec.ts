import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { RepeatListComponent } from './repeat-list.component';
import { RepeatRowComponent } from './repeat-row.component';

interface Rule {
  id: number;
  title: string;
}

@Component({
  imports: [RepeatListComponent, RepeatRowComponent],
  template: `<ft-repeat-list label="Rules">
    @for (rule of rules(); track rule.id; let i = $index, first = $first, last = $last) {
      <ft-repeat-row
        [heading]="'Rule 0' + (i + 1)"
        [object]="rule.title"
        [first]="first"
        [last]="last"
        (moveUp)="move(i, -1)"
        (moveDown)="move(i, 1)"
        (remove)="removed.set(rule.title)"
      >
        <label>Title <input class="title" [value]="rule.title" /></label>
      </ft-repeat-row>
    }
  </ft-repeat-list>`,
})
class HostComponent {
  rules = signal<Rule[]>([
    { id: 1, title: 'Start fresh' },
    { id: 2, title: 'Any stack' },
    { id: 3, title: '' },
  ]);
  removed = signal<string | null>(null);

  move(i: number, by: number) {
    const next = [...this.rules()];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    this.rules.set(next);
  }
}

@Component({
  imports: [RepeatListComponent, RepeatRowComponent, ReactiveFormsModule],
  template: `<ft-repeat-list label="Rules">
    @for (row of rows; track row; let i = $index) {
      <ft-repeat-row
        [heading]="'Rule 0' + (i + 1)"
        [object]="row.controls.title.value"
        [formGroup]="row"
      >
        <label>Title <input formControlName="title" /></label>
      </ft-repeat-row>
    }
  </ft-repeat-list>`,
})
class FormHostComponent {
  rows = [
    new FormGroup({ title: new FormControl('Start fresh') }),
    new FormGroup({ title: new FormControl('Any stack') }),
  ];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('ft-repeat-row'));
  const button = (name: string) =>
    el.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  return { fixture, el, rows, button };
}

// docs/design-system/components/repeat-list.html: an editable, ordered list of row cards in a hub wizard.
describe('RepeatListComponent', () => {
  it('is an ordered list named by its label, holding the rows', () => {
    const { el, rows } = setup();
    const ol = el.querySelector('ft-repeat-list ol') as HTMLOListElement;
    expect(ol.getAttribute('aria-label')).toBe('Rules');
    expect(rows()).toHaveLength(3);
    expect(rows().every((r) => r.getAttribute('role') === 'listitem')).toBe(true);
  });
});

describe('RepeatRowComponent', () => {
  it('groups its fields under its heading', () => {
    const { rows } = setup();
    const group = rows()[0].querySelector('[role="group"]') as HTMLElement;
    const heading = rows()[0].querySelector('h4') as HTMLElement;
    expect(heading.textContent?.trim()).toBe('Rule 01');
    expect(group.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(group.querySelector('input.title')).not.toBeNull();
    expect(rows()[1].querySelector('h4')?.id).not.toBe(heading.id);
  });

  // Reported from the running app: the group must be named by its heading ("Rule 01"), also when the caller binds a
  // form group on the row, as the hub wizards do.
  it('names each row group by its heading through aria-labelledby, resolved in the document', () => {
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    const groups = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'ft-repeat-row [role="group"]',
      ),
    );
    const names = groups.map((g) => {
      const id = g.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      const labels = document.querySelectorAll(`[id="${id}"]`);
      expect(labels).toHaveLength(1);
      expect(labels[0].tagName).toBe('H4');
      return labels[0].textContent?.trim();
    });
    expect(names).toEqual(['Rule 01', 'Rule 02']);
  });

  it('names its actions after the row, falling back to the heading', () => {
    const { button } = setup();
    expect(button('Move Start fresh up')).not.toBeNull();
    expect(button('Move Start fresh down')).not.toBeNull();
    expect(button('Remove Start fresh')).not.toBeNull();
    expect(button('Remove Rule 03')).not.toBeNull();
  });

  it('cannot move the first row up or the last row down', () => {
    const { button } = setup();
    expect(button('Move Start fresh up').disabled).toBe(true);
    expect(button('Move Start fresh down').disabled).toBe(false);
    expect(button('Move Rule 03 down').disabled).toBe(true);
    expect(button('Move Any stack up').disabled).toBe(false);
  });

  it('asks the caller to move or remove the row', () => {
    const { fixture, rows, button } = setup();
    button('Move Start fresh down').click();
    fixture.detectChanges();
    expect(rows()[0].querySelector('h4')?.textContent?.trim()).toBe('Rule 01');
    expect(button('Move Any stack up').disabled).toBe(true);
    button('Remove Any stack').click();
    expect(fixture.componentInstance.removed()).toBe('Any stack');
  });

  it('keeps focus on the moved row’s button, or its other move button once that one is disabled', async () => {
    const { fixture, button } = setup();
    button('Move Any stack down').focus();
    button('Move Any stack down').click();
    fixture.detectChanges();
    await fixture.whenStable();
    // Any stack is now last: its Move down is disabled, so focus goes to its Move up.
    expect(document.activeElement).toBe(button('Move Any stack up'));

    button('Move Any stack up').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Move Any stack up'));
  });
});
