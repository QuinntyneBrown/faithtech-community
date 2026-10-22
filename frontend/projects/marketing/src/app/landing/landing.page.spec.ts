// Traces to: L2-055
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LandingPage } from './landing.page';

describe('LandingPage', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('names the community in the page heading', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();

    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('Build with people who share your faith');
  });
});
