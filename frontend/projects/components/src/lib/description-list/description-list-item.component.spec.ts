import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DescriptionListItemComponent } from './description-list-item.component';

@Component({
  imports: [DescriptionListItemComponent],
  template: `<ft-description-list-item label="Organisation" [missing]="missing()"
    >Harbour Light</ft-description-list-item
  >`,
})
class HostComponent {
  missing = signal(false);
}

describe('DescriptionListItemComponent', () => {
  it('pairs the label term with the projected definition', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('dl > dt')?.textContent).toBe('Organisation');
    expect(el.querySelector('dl > dd')?.textContent).toContain('Harbour Light');
  });

  it('keeps the row and shows Not added in muted text when the value is missing', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.missing.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('dl > dt')?.textContent).toBe('Organisation');
    const dd = el.querySelector('dl > dd')!;
    expect(dd.textContent?.trim()).toBe('Not added');
    expect(dd.querySelector('.ft-dl__missing')).toBeTruthy();
  });
});
