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
      [movable]="movable()"
      (moveRequested)="moves.push($event)"
    />
  </ul>`,
})
class HostComponent {
  movable = signal(true);
  moves: unknown[] = [];
}

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

  it('has no Move button for read-only viewers', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.movable.set(false);
    fixture.detectChanges();
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('a')).not.toBeNull();
  });
});
