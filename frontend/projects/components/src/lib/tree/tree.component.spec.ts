import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeComponent } from './tree.component';
import { TreeItemComponent } from './tree-item.component';

@Component({
  imports: [TreeComponent, TreeItemComponent],
  template: `<ft-tree label="Backlog hierarchy">
    <ft-tree-item
      kind="Story"
      kindVariant="success"
      label="Shelter briefs"
      meta="In Progress"
      [expanded]="true"
    >
      <ft-tree-item kind="Task" label="Interview staff" href="/w/1" meta="Done" />
      <ft-tree-item kind="Task" label="Edit briefs" />
    </ft-tree-item>
    <ft-tree-item kind="Story" label="Collapsed story">
      <ft-tree-item kind="Task" label="Hidden child" />
    </ft-tree-item>
  </ft-tree>`,
})
class HostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TreeComponent', () => {
  it('is a labelled list', () => {
    const tree = setup().querySelector('ft-tree') as HTMLElement;
    expect(tree.getAttribute('role')).toBe('list');
    expect(tree.getAttribute('aria-label')).toBe('Backlog hierarchy');
  });
});

describe('TreeItemComponent', () => {
  const toggles = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button.ft-tree-item__toggle'));

  it('gives items with children a disclosure button named by the item', () => {
    const el = setup();
    const [open, closed] = toggles(el);
    expect(toggles(el)).toHaveLength(2);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.getAttribute('aria-label')).toBe('Contents of Shelter briefs');
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('details, summary')).toBeNull();
  });

  it('never nests the title link inside the disclosure control', () => {
    const el = setup();
    for (const toggle of toggles(el)) expect(toggle.querySelector('a')).toBeNull();
    const row = el.querySelector('ft-tree-item .ft-tree-item__row') as HTMLElement;
    expect(row.textContent).toContain('Story');
    expect(row.textContent).toContain('Shelter briefs');
    expect(row.textContent).toContain('In Progress');
  });

  it('shows and hides the children it controls', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const closed = toggles(el)[1];
    const list = el.querySelector(`#${closed.getAttribute('aria-controls')}`) as HTMLElement;
    expect(list.hidden).toBe(true);
    closed.click();
    fixture.detectChanges();
    expect(closed.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    closed.click();
    fixture.detectChanges();
    expect(list.hidden).toBe(true);
  });

  it('renders leaves without a disclosure, as a link when href is set', () => {
    const items = setup().querySelectorAll('ft-tree-item');
    expect(items[1].querySelector('button')).toBeNull();
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe('/w/1');
    expect(items[2].querySelector('a')).toBeNull();
  });

  it('nests children in a list', () => {
    const el = setup();
    expect(el.querySelectorAll('ft-tree-item > ul.ft-tree-item__children').length).toBe(2);
  });
});
