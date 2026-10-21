import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabComponent } from './tab.component';
import { TabsComponent } from './tabs.component';

@Component({
  imports: [TabsComponent, TabComponent],
  template: `<ft-tabs label="Workspace sections">
    <ft-tab label="Board" href="/board" [current]="true" />
    <ft-tab label="Backlog" href="/backlog" />
  </ft-tabs>`,
})
class NavHostComponent {}

@Component({
  imports: [TabsComponent, TabComponent],
  template: `<ft-tabs label="RSVPs" [(selectedIndex)]="index">
    <ft-tab label="Going"><p>Going panel</p></ft-tab>
    <ft-tab label="Waitlist"><p>Waitlist panel</p></ft-tab>
    <ft-tab label="Cancelled"><p>Cancelled panel</p></ft-tab>
  </ft-tabs>`,
})
class PanelHostComponent {
  index = signal(0);
}

function make<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, cmp: fixture.componentInstance };
}

const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('TabsComponent navigation mode', () => {
  it('renders a labelled nav of links with aria-current', () => {
    const { host } = make(NavHostComponent);
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Workspace sections');
    const links = host.querySelectorAll('nav a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/board');
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].getAttribute('aria-current')).toBeNull();
    expect(host.querySelector('[role=tablist]')).toBeNull();
  });
});

describe('TabsComponent panel mode', () => {
  it('renders an APG tablist with the first tab selected', () => {
    const { host } = make(PanelHostComponent);
    const list = host.querySelector('[role=tablist]')!;
    expect(list.getAttribute('aria-label')).toBe('RSVPs');
    const tabs = host.querySelectorAll('[role=tab]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('links each tab to its panel and shows only the selected panel', () => {
    const { host } = make(PanelHostComponent);
    const tab = host.querySelector('[role=tab]')!;
    const panel = host.querySelector('[role=tabpanel]:not([hidden])')!;
    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    expect(panel.textContent).toContain('Going panel');
    expect(host.querySelectorAll('[role=tabpanel]:not([hidden])').length).toBe(1);
  });

  it('selects a tab on click and updates the model', () => {
    const { fixture, cmp, host } = make(PanelHostComponent);
    (host.querySelectorAll('[role=tab]')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(cmp.index()).toBe(1);
    expect(host.querySelector('[role=tabpanel]:not([hidden])')?.textContent).toContain(
      'Waitlist panel',
    );
  });

  it('moves with arrow keys, wrapping, and Home and End', () => {
    const { fixture, cmp, host } = make(PanelHostComponent);
    const tabs = () => host.querySelectorAll('[role=tab]');
    key(tabs()[0], 'ArrowRight');
    fixture.detectChanges();
    expect(cmp.index()).toBe(1);
    key(tabs()[1], 'End');
    fixture.detectChanges();
    expect(cmp.index()).toBe(2);
    key(tabs()[2], 'ArrowRight');
    fixture.detectChanges();
    expect(cmp.index()).toBe(0);
    key(tabs()[0], 'ArrowLeft');
    fixture.detectChanges();
    expect(cmp.index()).toBe(2);
    key(tabs()[2], 'Home');
    fixture.detectChanges();
    expect(cmp.index()).toBe(0);
  });
});
