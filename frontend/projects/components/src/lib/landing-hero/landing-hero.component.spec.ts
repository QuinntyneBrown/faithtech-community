import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BenefitComponent } from './benefit.component';
import { CtaBandComponent } from './cta-band.component';
import { LandingHeroComponent } from './landing-hero.component';

@Component({
  imports: [LandingHeroComponent, BenefitComponent, CtaBandComponent],
  template: `
    <ft-landing-hero eyebrow="FaithTech Community" heading="Build together" lead="Meet builders.">
      <section ftHeroPanel><h2>Sign in</h2></section>
      <figure ftHeroMedia>Video</figure>
    </ft-landing-hero>
    <ft-benefit icon="team" heading="Find your city team">See who builds near you.</ft-benefit>
    <ft-cta-band heading="Ready to build with us?" text="It’s free."
      ><button>Join now</button></ft-cta-band
    >
  `,
})
class HostComponent {}

describe('Landing hero, benefit and call to action', () => {
  function setup(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the eyebrow, the page heading and the lead before the panel and the media', () => {
    const hero = setup().querySelector('ft-landing-hero')!;

    expect(hero.querySelector('h1')?.textContent).toBe('Build together');
    expect(hero.querySelector('.landing-hero__eyebrow')?.textContent).toBe('FaithTech Community');
    expect(hero.querySelector('.landing-hero__lead')?.textContent).toBe('Meet builders.');
    const order = [...hero.children].map((c) => c.className);
    expect(order).toEqual(['landing-hero__copy', 'landing-hero__panel', 'landing-hero__media']);
    expect(hero.querySelector('.landing-hero__panel h2')?.textContent).toBe('Sign in');
    expect(hero.querySelector('.landing-hero__media figure')).not.toBeNull();
  });

  it('gives a benefit a level-3 heading and a decorative icon', () => {
    const benefit = setup().querySelector('ft-benefit')!;

    expect(benefit.querySelector('h3')?.textContent).toBe('Find your city team');
    expect(benefit.querySelector('ft-icon-tile')?.getAttribute('aria-hidden')).toBe('true');
    expect(benefit.textContent).toContain('See who builds near you.');
  });

  it('names the call-to-action region by its heading', () => {
    const band = setup().querySelector('ft-cta-band')!;
    const heading = band.querySelector('h2')!;

    expect(band.getAttribute('role')).toBe('region');
    expect(band.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(band.querySelector('button')?.textContent).toBe('Join now');
  });
});
