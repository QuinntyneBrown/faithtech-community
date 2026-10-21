import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DescriptionListItemComponent } from './description-list-item.component';

@Component({
  imports: [DescriptionListItemComponent],
  template: `<ft-description-list-item label="Organisation"
    >Harbour Light</ft-description-list-item
  >`,
})
class HostComponent {}

describe('DescriptionListItemComponent', () => {
  it('pairs the label term with the projected definition', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('dl > dt')?.textContent).toBe('Organisation');
    expect(el.querySelector('dl > dd')?.textContent).toContain('Harbour Light');
  });
});
