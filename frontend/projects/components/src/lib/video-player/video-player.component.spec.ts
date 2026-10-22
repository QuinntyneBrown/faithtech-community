import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VideoPlayerComponent } from './video-player.component';

@Component({
  imports: [VideoPlayerComponent],
  template: `<ft-video-player
    src="/brochure/brochure.webm"
    poster="/brochure/brochure-poster.jpg"
    posterAlt="Builders at a hackathon"
    captions="/brochure/brochure.en.vtt"
    label="FaithTech Community in 21 seconds"
    caption="FaithTech Community in 21 seconds · captions on"
  />`,
})
class HostComponent {}

describe('VideoPlayerComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows controls, the poster and default captions, and never autoplays', () => {
    const video = setup().el.querySelector('video')!;
    const track = video.querySelector('track')!;

    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.getAttribute('poster')).toBe('/brochure/brochure-poster.jpg');
    expect(video.getAttribute('aria-label')).toBe('FaithTech Community in 21 seconds');
    expect(track.kind).toBe('captions');
    expect(track.default).toBe(true);
    expect(track.srclang).toBe('en');
  });

  it('offers no transcript', () => {
    expect(setup().el.querySelector('details')).toBeNull();
  });

  it('falls back to the poster and a message when the video fails', () => {
    const { fixture, el } = setup();

    el.querySelector('video')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el.querySelector('video')).toBeNull();
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Builders at a hackathon');
    expect(el.querySelector('ft-alert')?.textContent).toContain('This video can’t play right now');
    expect(el.querySelector('ft-alert')?.textContent).toContain('Please try again later.');
  });
});
