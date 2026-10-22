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

  // Given an event list is loading, when its rows show, then each leads with a square date-badge
  // placeholder rather than a round avatar, so the row keeps its shape when the events arrive.
  it('leads each row with a square date-badge placeholder for event rows', () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('label', 'Loading events');
    fixture.componentRef.setInput('rows', 2);
    fixture.componentRef.setInput('leading', 'date-badge');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const rows = host.querySelectorAll('.ft-list-skeleton__row');
    rows.forEach((row) => {
      expect(row.firstElementChild?.classList.contains('ft-skeleton--date-badge')).toBe(true);
      expect(row.querySelector('.ft-skeleton--avatar')).toBeNull();
    });
    expect(rows.length).toBe(2);
  });

  // Given a list is loading, when its placeholder renders, then the rows are items of a real list,
  // as the rows that replace them are, and the empty placeholder list is hidden from assistive tech.
  it('renders its rows as items of a list hidden from assistive technology', () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('label', 'Loading contacts');
    fixture.componentRef.setInput('rows', 3);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const list = host.querySelector('ul');
    expect(list?.getAttribute('aria-hidden')).toBe('true');
    expect(list?.querySelectorAll(':scope > li.ft-list-skeleton__row').length).toBe(3);
  });

  it('leads each row with a round avatar placeholder by default', () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('label', 'Loading users');
    fixture.detectChanges();
    const first = (fixture.nativeElement as HTMLElement).querySelector('.ft-list-skeleton__row');

    expect(first?.firstElementChild?.classList.contains('ft-skeleton--avatar')).toBe(true);
  });
});
