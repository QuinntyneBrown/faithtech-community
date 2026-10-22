import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SiteFooterComponent } from './site-footer.component';

@Component({
  imports: [SiteFooterComponent],
  template: `<ft-site-footer copyright="© 2026 FaithTech"
    ><li><a href="#join">Join now</a></li></ft-site-footer
  >`,
})
class HostComponent {}

describe('SiteFooterComponent', () => {
  it('is a footer landmark with the copyright and a list of links', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const footer = (fixture.nativeElement as HTMLElement).querySelector('footer')!;

    expect(footer.textContent).toContain('© 2026 FaithTech');
    expect(footer.querySelector('ul li a')?.textContent).toBe('Join now');
  });
});
