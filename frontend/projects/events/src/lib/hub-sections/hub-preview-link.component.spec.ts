// Traces to: L2-163 AC4 (docs/detailed-designs/events/preview-and-publish-hub)
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HubPreviewLinkComponent } from './hub-preview-link.component';

describe('HubPreviewLinkComponent', () => {
  it('links to the hub page in a new tab and says so to screen readers', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HubPreviewLinkComponent);
    fixture.componentRef.setInput('eventId', 'e1');
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/public/events/e1/hub');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(link?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Preview the hub (new tab)');
  });
});
