import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoteComponent } from './note.component';

@Component({
  imports: [NoteComponent],
  template: `<ft-note [date]="date()"><p>Met at Builders Night.</p></ft-note>`,
})
class HostComponent {
  date = signal<string | null>('Thu 18 Sep');
}

describe('NoteComponent', () => {
  it('shows the note text and the date', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Met at Builders Night.');
    expect(el.querySelector('.ft-note__meta')?.textContent).toBe('Thu 18 Sep');
  });

  it('is not focusable', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('ft-note') as HTMLElement;
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('omits the meta line without a date', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.date.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ft-note__meta')).toBeNull();
  });
});
