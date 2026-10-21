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
  it('uses a native disclosure for items with children', () => {
    const details = setup().querySelectorAll('ft-tree-item > details');
    expect(details.length).toBe(2);
    expect((details[0] as HTMLDetailsElement).open).toBe(true);
    expect((details[1] as HTMLDetailsElement).open).toBe(false);
    expect(details[0].querySelector(':scope > summary')).not.toBeNull();
  });

  it('shows kind badge, label and meta', () => {
    const summary = setup().querySelector('summary') as HTMLElement;
    expect(summary.textContent).toContain('Story');
    expect(summary.textContent).toContain('Shelter briefs');
    expect(summary.textContent).toContain('In Progress');
  });

  it('renders leaves without a disclosure, as a link when href is set', () => {
    const items = setup().querySelectorAll('ft-tree-item');
    expect(items[1].querySelector('details')).toBeNull();
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe('/w/1');
    expect(items[2].querySelector('a')).toBeNull();
  });

  it('nests children in a list', () => {
    const el = setup();
    expect(el.querySelectorAll('ft-tree-item > details > ul.ft-tree-item__children').length).toBe(
      2,
    );
  });
});
