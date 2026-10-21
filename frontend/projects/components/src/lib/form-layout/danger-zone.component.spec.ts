import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DangerZoneComponent } from './danger-zone.component';

@Component({
  imports: [DangerZoneComponent],
  template: `<ft-danger-zone heading="Archive workspace">
    Members lose access.
    <button ftDangerAction type="button">Archive</button>
  </ft-danger-zone>`,
})
class HostComponent {}

describe('DangerZoneComponent', () => {
  it('is a section labelled by its heading, with description and action', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const host: HTMLElement = f.nativeElement;
    const section = host.querySelector('section')!;
    const h = host.querySelector('h3')!;
    expect(h.textContent).toContain('Archive workspace');
    expect(section.getAttribute('aria-labelledby')).toBe(h.id);
    expect(host.querySelector('p')!.textContent).toContain('Members lose access.');
    expect(host.querySelector('p')!.textContent).not.toContain('Archive');
    expect(host.querySelector('button')!.textContent).toContain('Archive');
  });
});
