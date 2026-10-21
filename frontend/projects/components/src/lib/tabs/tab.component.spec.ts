import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabComponent } from './tab.component';

@Component({
  imports: [TabComponent],
  template: `<ft-tab label="Going"><p class="body">Content</p></ft-tab>`,
})
class HostComponent {}

describe('TabComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const tab = fixture.debugElement.children[0].componentInstance as TabComponent;
    return { fixture, tab };
  }

  it('exposes its label with no link and not current by default', () => {
    const { tab } = setup();
    expect(tab.label()).toBe('Going');
    expect(tab.href()).toBeNull();
    expect(tab.current()).toBe(false);
  });

  it('does not render its content until it is the active panel', () => {
    const { fixture, tab } = setup();
    expect(fixture.nativeElement.querySelector('.body')).toBeNull();
    tab.active.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.body')).toBeTruthy();
  });
});
