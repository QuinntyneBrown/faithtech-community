import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormActionsComponent } from './form-actions.component';

@Component({
  imports: [FormActionsComponent],
  template: `<ft-form-actions
    ><a href="/">Cancel</a><button type="submit">Save</button></ft-form-actions
  >`,
})
class HostComponent {}

describe('FormActionsComponent', () => {
  it('projects its buttons in order', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const kids = Array.from(
      f.nativeElement.querySelector('ft-form-actions').children,
    ) as HTMLElement[];
    expect(kids.map((k) => k.textContent)).toEqual(['Cancel', 'Save']);
  });
});
