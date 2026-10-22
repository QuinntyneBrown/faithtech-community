import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PhotoGalleryComponent, PhotoGalleryPhoto } from './photo-gallery.component';

@Component({
  imports: [PhotoGalleryComponent],
  template: `<ft-photo-gallery
    [photos]="photos()"
    (featured)="featured.push($event)"
    (describe)="described.push($event)"
    (remove)="removed.push($event)"
  />`,
})
class HostComponent {
  photos = signal<PhotoGalleryPhoto[]>([
    { id: 'p2', url: 'blob:coffee', alt: 'At the coffee morning', featured: false },
    { id: 'p1', url: 'blob:outside', alt: 'Outside the shelter', featured: true },
    { id: 'p3', url: null, alt: 'Demoing the dashboard', featured: false, storing: true },
  ]);
  featured: number[] = [];
  described: number[] = [];
  removed: number[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const items = () => Array.from(host.querySelectorAll<HTMLElement>('li'));
  const button = (name: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.replace(/\s+/g, ' ').trim() === name,
    )!;
  return { fixture, cmp: fixture.componentInstance, host, items, button };
}

describe('PhotoGalleryComponent', () => {
  it('lists each photo with its description as alt text and caption, and marks the featured one', () => {
    const { items } = setup();
    expect(items()).toHaveLength(3);
    const [coffee, outside] = items();
    expect(coffee.querySelector('img')!.getAttribute('alt')).toBe('At the coffee morning');
    expect(coffee.querySelector('.ft-photo-gallery__caption')!.textContent!.trim()).toBe(
      'At the coffee morning',
    );
    expect(outside.textContent).toContain('Featured');
    expect(coffee.textContent).not.toContain('Featured');
  });

  it('shows a storing photo as a described placeholder with a status note', () => {
    const { items } = setup();
    const storing = items()[2];
    expect(storing.querySelector('img')).toBeNull();
    expect(storing.querySelector('.visually-hidden')!.textContent).toContain(
      'Demoing the dashboard',
    );
    const note = storing.querySelector('[role="status"]')!;
    expect(note.textContent).toContain('Saved. It shows here once it finishes storing.');
  });

  it('offers Feature on photos that are not featured, and Edit description and Delete on every photo', () => {
    const { cmp, items, button } = setup();
    expect(items()[1].textContent).not.toContain('Feature photo');
    button('Feature photo 1').click();
    button('Edit description of photo 2').click();
    button('Delete photo 3').click();
    expect(cmp.featured).toEqual([0]);
    expect(cmp.described).toEqual([1]);
    expect(cmp.removed).toEqual([2]);
  });
});
