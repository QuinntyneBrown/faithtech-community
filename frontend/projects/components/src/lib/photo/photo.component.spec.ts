import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PhotoComponent, PhotoState } from './photo.component';

@Component({
  imports: [PhotoComponent],
  template: `<ft-photo
    [src]="src()"
    [alt]="alt()"
    [featured]="featured()"
    [state]="state()"
    [progress]="progress()"
    ><button type="button">Remove photo 1</button></ft-photo
  >`,
})
class HostComponent {
  src = signal<string | null>('/p/1.jpg');
  alt = signal('Grace speaking at Builders Night');
  featured = signal(false);
  state = signal<PhotoState | null>(null);
  progress = signal<number | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T | null;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('PhotoComponent', () => {
  it('shows the picture with the description the member wrote as its alt text', () => {
    const { q } = setup();
    const img = q<HTMLImageElement>('img')!;
    expect(img.getAttribute('src')).toBe('/p/1.jpg');
    expect(img.getAttribute('alt')).toBe('Grace speaking at Builders Night');
  });

  it('is a labelled image placeholder when there is no picture yet', () => {
    const { fixture, cmp, q } = setup();
    cmp.src.set(null);
    fixture.detectChanges();
    expect(q('img')).toBeNull();
    const ph = q('[role="img"]')!;
    expect(ph.getAttribute('aria-label')).toBe('Grace speaking at Builders Night');
  });

  it('marks a featured photo with an accent ring', () => {
    const { fixture, cmp, q } = setup();
    expect(q('.ft-photo')!.classList.contains('ft-photo--featured')).toBe(false);
    cmp.featured.set(true);
    fixture.detectChanges();
    expect(q('.ft-photo')!.classList.contains('ft-photo--featured')).toBe(true);
  });

  it('is busy and announces progress politely while uploading', () => {
    const { fixture, cmp, q } = setup();
    cmp.state.set('uploading');
    cmp.progress.set(60);
    fixture.detectChanges();
    expect(q('.ft-photo__thumb')!.getAttribute('aria-busy')).toBe('true');
    expect(q('[role="status"]')!.textContent).toContain('Uploading… 60%');
  });

  it('is not busy when idle', () => {
    const { q } = setup();
    expect(q('.ft-photo__thumb')!.getAttribute('aria-busy')).toBeNull();
    expect(q('[role="status"]')!.textContent!.trim()).toBe('');
  });

  it('shows a danger border when the upload failed', () => {
    const { fixture, cmp, q } = setup();
    cmp.state.set('failed');
    fixture.detectChanges();
    expect(q('.ft-photo')!.classList.contains('ft-photo--failed')).toBe(true);
  });

  it('places projected controls over the thumbnail', () => {
    const { q } = setup();
    expect(q('.ft-photo__thumb button')!.textContent).toBe('Remove photo 1');
  });
});
