import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReorderableItem } from './reorderable-item';
import { ReorderableListComponent } from './reorderable-list.component';
import { ReorderableActionsDirective } from './reorderable-actions.directive';

@Component({
  imports: [ReorderableListComponent, ReorderableActionsDirective],
  template: `
    <ft-reorderable-list
      label="Cities"
      [items]="items()"
      [readonly]="readonly()"
      (reordered)="order = $event"
    >
      <ng-template ftReorderableActions let-item>
        <button type="button">Rename {{ item.title }}</button>
      </ng-template>
    </ft-reorderable-list>
  `,
})
class HostComponent {
  readonly items = signal<ReorderableItem[]>([
    {
      id: 'a',
      title: 'Toronto',
      meta: '186 members',
      badges: [{ label: 'Initial', variant: 'info' }, { label: 'Open' }],
    },
    { id: 'b', title: 'Austin', meta: '97 members' },
    { id: 'c', title: 'Vancouver', meta: '64 members' },
  ]);
  readonly readonly = signal(false);
  order: string[] | null = null;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  const titles = () =>
    Array.from(host.querySelectorAll('.ft-reorderable-list__title')).map((t) => t.textContent);
  return { fixture, host, button, titles };
}

describe('ReorderableListComponent', () => {
  it('shows a row’s lead before its title and its warning under it', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.items.set([
      { id: 'a', title: 'Clean up', lead: '9:30 pm', warning: 'Outside the event’s times' },
    ]);
    fixture.detectChanges();

    const row = host.querySelector('.ft-reorderable-list__item')!;
    expect(row.querySelector('.ft-reorderable-list__lead')?.textContent).toBe('9:30 pm');
    expect(row.querySelector('.ft-reorderable-list__warning')?.textContent?.trim()).toBe(
      'Outside the event’s times',
    );
    expect(host.querySelector('button[aria-label="Move Clean up up"]')).not.toBeNull();
  });

  it('shows the badges of a row under its meta', () => {
    const { host } = setup();
    const badges = host
      .querySelectorAll('.ft-reorderable-list__item')[0]
      .querySelectorAll('ft-badge');
    expect([...badges].map((b) => b.textContent?.trim())).toEqual(['Initial', 'Open']);
  });

  it('lists each row with its meta, move buttons and actions, ends disabled', () => {
    const { host, button, titles } = setup();
    expect(host.querySelector('ul')!.getAttribute('aria-label')).toBe('Cities');
    expect(titles()).toEqual(['Toronto', 'Austin', 'Vancouver']);
    expect(host.textContent).toContain('186 members');
    expect(host.textContent).toContain('Rename Austin');
    expect(button('Move Toronto up').disabled).toBe(true);
    expect(button('Move Toronto down').disabled).toBe(false);
    expect(button('Move Vancouver down').disabled).toBe(true);
  });

  it('moves a row by keyboard, emits the new order and announces it', () => {
    const { fixture, host, button, titles } = setup();
    button('Move Vancouver up').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.order).toEqual(['a', 'c', 'b']);
    expect(titles()).toEqual(['Toronto', 'Vancouver', 'Austin']);
    expect(host.querySelector('[aria-live="polite"]')!.textContent?.trim()).toBe(
      'Moved Vancouver up to position 2 of 3.',
    );
    expect(host.querySelector('.ft-reorderable-list__item--moved')!.textContent).toContain(
      'Vancouver',
    );
  });

  it('keeps focus on a move button when the one pressed becomes disabled', async () => {
    const { fixture, button } = setup();
    button('Move Austin up').focus();
    button('Move Austin up').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Austin down');
  });

  it('shows no handle, move buttons or actions when read-only', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();
    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(host.querySelector('.ft-reorderable-list__handle')).toBeNull();
  });
});
