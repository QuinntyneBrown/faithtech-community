import { CdkDrag } from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { KanbanCardComponent } from './kanban-card.component';

@Component({
  imports: [KanbanCardComponent],
  template: `<ul>
    <ft-kanban-card
      cardId="kestrel"
      title="Kestrel Labs"
      href="/partners/kestrel-labs"
      caption="Hosting Builders Night · contract review"
      [detail]="detail()"
      [movable]="movable()"
      (moveRequested)="moves.push($event)"
    />
  </ul>`,
})
class HostComponent {
  detail = signal<string | null>(null);
  movable = signal(true);
  moves: unknown[] = [];
}

@Component({
  imports: [KanbanCardComponent],
  template: `<ul>
    <ft-kanban-card
      cardId="kiosk"
      title="Volunteer check-in kiosk"
      href="/workspaces/w1/items/kiosk"
      caption="Samuel · 5 pts · 0/3 tasks"
      kind="Story"
      kindVariant="success"
      moveTarget="another column"
    />
  </ul>`,
})
class BoardCardHostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, cmp: fixture.componentInstance, host };
}

describe('KanbanCardComponent', () => {
  it('is a list item with the name as a link and a caption', () => {
    const { host } = setup();
    expect(host.querySelector('ft-kanban-card')!.getAttribute('role')).toBe('listitem');
    const a = host.querySelector<HTMLAnchorElement>('a')!;
    expect(a.getAttribute('href')).toBe('/partners/kestrel-labs');
    expect(a.textContent!.trim()).toBe('Kestrel Labs');
    expect(host.textContent).toContain('Hosting Builders Night · contract review');
  });

  it('has a Move button that names the card and requests a move', () => {
    const { cmp, host } = setup();
    const move = host.querySelector<HTMLButtonElement>('button')!;
    expect(move.getAttribute('aria-label')).toBe('Move Kestrel Labs to another stage');
    move.click();
    expect(cmp.moves).toEqual(['kestrel']);
  });

  it('can be dragged only when movable', () => {
    const { fixture } = setup();
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    expect(drag.disabled).toBe(false);
    expect(drag.data).toBe('kestrel');
    fixture.componentInstance.movable.set(false);
    fixture.detectChanges();
    expect(drag.disabled).toBe(true);
  });

  it('shows an optional kind badge and names the move target', () => {
    const fixture = TestBed.createComponent(BoardCardHostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('ft-badge')!.textContent!.trim()).toBe('Story');
    expect(host.querySelector('button')!.getAttribute('aria-label')).toBe(
      'Move Volunteer check-in kiosk to another column',
    );
  });

  it('has no Move button for read-only viewers', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.movable.set(false);
    fixture.detectChanges();
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('a')).not.toBeNull();
  });

  // Traces to: partner pipeline next step (components/kanban.html, Card with a next step).
  // Given a partner whose latest activity has a next step, When its card renders, Then a second
  // caption line "Next: …" follows the caption in reading order; without one no line shows.
  it('shows the next-step detail line after the caption', () => {
    const { fixture, cmp, host } = setup();
    cmp.detail.set('Next: Send credit-line wording · Wed 22 Oct');
    fixture.detectChanges();
    const captions = Array.from(host.querySelectorAll('.ft-kanban__caption'));
    expect(captions.map((c) => c.textContent?.trim())).toEqual([
      'Hosting Builders Night · contract review',
      'Next: Send credit-line wording · Wed 22 Oct',
    ]);
  });

  it('shows no detail line when there is no next step', () => {
    const { host } = setup();
    expect(host.querySelectorAll('.ft-kanban__caption').length).toBe(1);
    expect(host.textContent).not.toContain('Next:');
  });
});
