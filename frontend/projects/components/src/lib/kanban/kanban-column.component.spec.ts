import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KanbanCardComponent } from './kanban-card.component';
import { KanbanColumnComponent } from './kanban-column.component';

@Component({
  imports: [KanbanColumnComponent, KanbanCardComponent],
  template: `<ft-kanban-column
    title="In funnel"
    stage="funnel"
    [count]="count()"
    [emptyText]="empty()"
  >
    @for (c of cards(); track c) {
      <ft-kanban-card [cardId]="c" [title]="c" href="/p" />
    }
  </ft-kanban-column>`,
})
class HostComponent {
  count = signal(2);
  empty = signal('No partners at this stage yet');
  cards = signal(['Lantern Foundation', 'Kestrel Labs']);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, cmp: fixture.componentInstance, host };
}

describe('KanbanColumnComponent', () => {
  it('is a section labelled by its title heading', () => {
    const { host } = setup();
    const section = host.querySelector('section')!;
    const h = section.querySelector('h2')!;
    expect(h.textContent!.trim()).toBe('In funnel');
    expect(section.getAttribute('aria-labelledby')).toBe(h.id);
  });

  it('shows the card count in a badge', () => {
    const { host } = setup();
    expect(host.querySelector('ft-badge')!.textContent!.trim()).toBe('2');
  });

  it('lists projected cards in a list', () => {
    const { host } = setup();
    expect(host.querySelectorAll('ul ft-kanban-card')).toHaveLength(2);
    expect(host.querySelector('.ft-kanban__empty')).toBeNull();
  });

  it('shows the empty message when the column has no cards', () => {
    const { fixture, cmp, host } = setup();
    cmp.count.set(0);
    cmp.cards.set([]);
    fixture.detectChanges();
    expect(host.querySelector('.ft-kanban__empty')!.textContent!.trim()).toBe(
      'No partners at this stage yet',
    );
  });
});
