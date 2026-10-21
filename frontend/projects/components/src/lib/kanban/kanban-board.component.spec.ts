import { CdkDropList } from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { KanbanBoardComponent } from './kanban-board.component';
import { KanbanCardComponent } from './kanban-card.component';
import { KanbanColumnComponent, KanbanCardDrop } from './kanban-column.component';

@Component({
  imports: [KanbanBoardComponent, KanbanColumnComponent, KanbanCardComponent],
  template: `<ft-kanban-board label="Partner pipeline" [announcement]="announcement()">
    <ft-kanban-column title="Lead" stage="lead" [count]="1" (cardDropped)="drops.push($event)">
      <ft-kanban-card
        cardId="maple"
        title="Maple Street Church"
        href="/partners/maple"
        caption="Venue for spring builders night"
        (moveRequested)="moves.push($event)"
      />
    </ft-kanban-column>
    <ft-kanban-column
      title="In funnel"
      stage="funnel"
      [count]="0"
      emptyText="No partners at this stage yet"
      (cardDropped)="drops.push($event)"
    />
    <ft-kanban-column
      title="Confirmed"
      stage="confirmed"
      [count]="0"
      (cardDropped)="drops.push($event)"
    />
  </ft-kanban-board>`,
})
class HostComponent {
  announcement = signal('');
  drops: KanbanCardDrop[] = [];
  moves: unknown[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, cmp: fixture.componentInstance, host };
}

describe('KanbanBoardComponent', () => {
  it('is a region named by its label', () => {
    const { host } = setup();
    const region = host.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Partner pipeline');
  });

  it('announces a move politely in a visually hidden live region', () => {
    const { fixture, cmp, host } = setup();
    const live = host.querySelector('[aria-live="polite"]')!;
    expect(live.classList.contains('visually-hidden')).toBe(true);
    cmp.announcement.set('Kestrel Labs moved to Confirmed');
    fixture.detectChanges();
    expect(live.textContent).toContain('Kestrel Labs moved to Confirmed');
  });

  it('connects every column so a card can be dragged between them', () => {
    const { fixture } = setup();
    const lists = fixture.debugElement
      .queryAll(By.directive(CdkDropList))
      .map((d) => d.injector.get(CdkDropList));
    expect(lists).toHaveLength(3);
    // Dropping into another column is reported by that column.
    lists[1].dropped.emit({
      item: { data: 'maple' },
      previousContainer: lists[0],
      container: lists[1],
      currentIndex: 0,
    } as never);
    expect(fixture.componentInstance.drops).toEqual([
      { cardId: 'maple', from: 'lead', to: 'funnel', index: 0 },
    ]);
  });

  it('reports a card move requested from the keyboard-friendly Move button', () => {
    const { host, fixture } = setup();
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(fixture.componentInstance.moves).toEqual(['maple']);
  });
});
