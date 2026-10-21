import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EstimateCardComponent, EstimateVote } from './estimate-card.component';

@Component({
  imports: [EstimateCardComponent],
  template: `<ft-estimate-card
    [person]="person()"
    [vote]="vote()"
    [revealed]="revealed()"
    [size]="size()"
  />`,
})
class HostComponent {
  person = signal('Grace Okonkwo');
  vote = signal<EstimateVote | null>(null);
  revealed = signal(false);
  size = signal<'md' | 'lg'>('md');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const card = () => fixture.nativeElement.querySelector('[role="img"]') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, card };
}

describe('EstimateCardComponent', () => {
  it('shows an ellipsis and says the person is still choosing before they vote', () => {
    const { card } = setup();
    expect(card().textContent!.trim()).toBe('…');
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: still choosing');
  });

  it('shows a tick, not the points, once voted but not yet revealed', () => {
    const { fixture, cmp, card } = setup();
    cmp.vote.set(8);
    fixture.detectChanges();
    expect(card().textContent!.trim()).toBe('✓');
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: voted');
    expect(card().textContent).not.toContain('8');
  });

  it('shows the points and names person and value after the reveal', () => {
    const { fixture, cmp, card } = setup();
    cmp.vote.set(8);
    cmp.revealed.set(true);
    fixture.detectChanges();
    expect(card().textContent!.trim()).toBe('8');
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: 8 points');
  });

  it('uses the singular for one point', () => {
    const { fixture, cmp, card } = setup();
    cmp.vote.set(1);
    cmp.revealed.set(true);
    fixture.detectChanges();
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: 1 point');
  });

  it('shows an unsure vote as a question mark', () => {
    const { fixture, cmp, card } = setup();
    cmp.vote.set('?');
    cmp.revealed.set(true);
    fixture.detectChanges();
    expect(card().textContent!.trim()).toBe('?');
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: unsure');
  });

  it('still shows the person as choosing after a reveal when they never voted', () => {
    const { fixture, cmp, card } = setup();
    cmp.revealed.set(true);
    fixture.detectChanges();
    expect(card().getAttribute('aria-label')).toBe('Grace Okonkwo: still choosing');
  });

  it('supports the large size', () => {
    const { fixture, cmp } = setup();
    cmp.size.set('lg');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ft-estimate-card--lg')).not.toBeNull();
  });
});
