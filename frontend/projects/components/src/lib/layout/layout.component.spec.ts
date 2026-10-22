import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClusterComponent } from './cluster.component';
import { ContainerComponent } from './container.component';
import { GridComponent } from './grid.component';
import { PageHeaderComponent } from './page-header.component';
import { SplitComponent } from './split.component';
import { StackComponent, StackWidth } from './stack.component';

@Component({
  imports: [
    ContainerComponent,
    StackComponent,
    ClusterComponent,
    GridComponent,
    SplitComponent,
    PageHeaderComponent,
  ],
  template: `
    <ft-container><i class="c">c</i></ft-container>
    <ft-stack [gap]="gap()" [width]="width()"><i class="s">s</i></ft-stack>
    <ft-cluster [between]="between()"><i>x</i></ft-cluster>
    <ft-grid [columns]="columns()" [auto]="auto()"><i>g</i></ft-grid>
    <ft-split
      ><div ftSplitMain>main</div>
      <aside ftSplitAside>aside</aside></ft-split
    >
    <ft-page-header title="Good afternoon, Grace" subtitle="Tuesday">
      <button ftPageHeaderActions>New event</button>
    </ft-page-header>
    <ft-page-header
      class="public"
      overline="FaithTech Toronto · Public event"
      title="Builders Night"
    />
    <ft-page-header class="rich" title="Kestrel Labs">
      <span ftPageHeaderSubtitle><b>In funnel</b> · Venue</span>
    </ft-page-header>
  `,
})
class HostComponent {
  gap = signal('4');
  width = signal<StackWidth | null>(null);
  between = signal(false);
  columns = signal<number | null>(null);
  auto = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, cmp: fixture.componentInstance };
}

describe('layout primitives', () => {
  it('projects children into container and stack', () => {
    const { host } = setup();
    expect(host.querySelector('ft-container .c')).toBeTruthy();
    expect(host.querySelector('ft-stack .s')).toBeTruthy();
  });

  it('stack exposes its gap as a space token', () => {
    const { fixture, cmp, host } = setup();
    const stack = host.querySelector('ft-stack') as HTMLElement;
    expect(stack.style.getPropertyValue('--ft-stack-gap')).toBe('var(--space-4)');
    cmp.gap.set('8');
    fixture.detectChanges();
    expect(stack.style.getPropertyValue('--ft-stack-gap')).toBe('var(--space-8)');
  });

  it('stack caps its width at a form width only when asked (.form-width--sm/md/lg)', () => {
    const { fixture, cmp, host } = setup();
    const stack = host.querySelector('ft-stack') as HTMLElement;
    expect([...stack.classList].some((c) => c.startsWith('ft-stack--width'))).toBe(false);
    for (const w of ['sm', 'md', 'lg'] as const) {
      cmp.width.set(w);
      fixture.detectChanges();
      expect(stack.classList).toContain(`ft-stack--width-${w}`);
    }
  });

  it('cluster toggles the between modifier', () => {
    const { fixture, cmp, host } = setup();
    const c = host.querySelector('ft-cluster') as HTMLElement;
    expect(c.classList).not.toContain('ft-cluster--between');
    cmp.between.set(true);
    fixture.detectChanges();
    expect(c.classList).toContain('ft-cluster--between');
  });

  it('grid sets explicit columns or auto-fill', () => {
    const { fixture, cmp, host } = setup();
    const g = host.querySelector('ft-grid') as HTMLElement;
    cmp.columns.set(2);
    fixture.detectChanges();
    expect(g.style.getPropertyValue('--layout-columns')).toBe('2');
    cmp.auto.set(true);
    fixture.detectChanges();
    expect(g.classList).toContain('ft-grid--auto');
  });

  it('split projects main and aside columns', () => {
    const { host } = setup();
    expect(host.querySelector('ft-split .ft-split__main')?.textContent).toContain('main');
    expect(host.querySelector('ft-split .ft-split__aside')?.textContent).toContain('aside');
  });

  it('page header renders the h1, subtitle and actions', () => {
    const { host } = setup();
    expect(host.querySelector('ft-page-header h1')?.textContent).toContain('Good afternoon');
    expect(host.querySelector('ft-page-header .page-header__subtitle')?.textContent).toContain(
      'Tuesday',
    );
    expect(host.querySelector('ft-page-header button')).toBeTruthy();
  });

  it('page header takes rich subtitle content such as a status badge', () => {
    const { host } = setup();
    const subtitle = host.querySelector('ft-page-header.rich .page-header__subtitle')!;
    expect(subtitle.querySelector('b')!.textContent).toBe('In funnel');
    expect(subtitle.textContent).toContain('· Venue');
  });

  it('page header shows an overline above the h1 only when given one', () => {
    const { host } = setup();
    const overline = host.querySelector('ft-page-header.public .page-header__overline')!;
    expect(overline.textContent!.trim()).toBe('FaithTech Toronto · Public event');
    expect(overline.compareDocumentPosition(host.querySelector('ft-page-header.public h1')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(host.querySelector('ft-page-header.rich .page-header__overline')).toBeNull();
  });
});
