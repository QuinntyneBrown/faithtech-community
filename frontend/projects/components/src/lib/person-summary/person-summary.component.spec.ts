import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PersonSummaryComponent } from './person-summary.component';

@Component({
  imports: [PersonSummaryComponent],
  template: `<ft-person-summary
    name="Grace Okonkwo"
    [meta]="meta()"
    [photoUrl]="photo()"
    color="sky"
  />`,
})
class HostComponent {
  meta = signal<string | null>('City Lead · Toronto');
  photo = signal<string | null>('https://photos.example/grace.jpg');
}

describe('PersonSummaryComponent', () => {
  it('shows the decorative photo, the name and the meta line', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ft-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://photos.example/grace.jpg');
    expect(el.querySelector('.ft-person-summary__name')?.textContent).toBe('Grace Okonkwo');
    expect(el.querySelector('.ft-person-summary__meta')?.textContent).toBe('City Lead · Toronto');
  });

  it('leaves out an empty meta line', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.meta.set(null);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ft-person-summary__meta'),
    ).toBeNull();
  });
});
