import { TestBed } from '@angular/core/testing';
import { ListSkeletonComponent } from './list-skeleton.component';

describe('ListSkeletonComponent', () => {
  it('shows the given number of placeholder rows, busy and labelled', () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('label', 'Loading invites');
    fixture.componentRef.setInput('rows', 3);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.getAttribute('aria-label')).toBe('Loading invites');
    expect(host.querySelectorAll('.ft-list-skeleton__row').length).toBe(3);
  });
});
