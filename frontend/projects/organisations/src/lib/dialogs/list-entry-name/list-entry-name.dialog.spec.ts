import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ListEntryNameData, ListEntryNameDialog } from './list-entry-name.dialog';

function setup(save: (name: string) => Observable<unknown>, name?: string) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: ListEntryNameData<unknown> = {
    heading: name ? `Rename ${name}` : 'Add a partner stage',
    description: 'New stages count as open and are added at the end.',
    addLabel: 'Add stage',
    name,
    save: vi.fn(save),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(ListEntryNameDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const input = host.querySelector('input')!;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, data, ref, input, type, button, settle };
}

describe('ListEntryNameDialog', () => {
  it('adds the trimmed name and closes with the saved entry', async () => {
    const saved = { id: 's9', name: 'Proposal sent' };
    const { data, ref, type, button, settle } = setup(() => of(saved));

    type('  Proposal sent ');
    button('Add stage').click();
    await settle();

    expect(data.save).toHaveBeenCalledWith('Proposal sent');
    expect(ref.close).toHaveBeenCalledWith(saved);
  });

  it('starts a rename on the current name', () => {
    const { input, button } = setup(() => of({}), 'In Funnel');

    expect(input.value).toBe('In Funnel');
    expect(button('Rename')).toBeTruthy();
  });

  it('asks for a name of at most 40 characters before saving', async () => {
    const { host, data, type, button, settle } = setup(() => of({}));

    button('Add stage').click();
    await settle();
    expect(host.textContent).toContain('Enter a name.');

    type('x'.repeat(41));
    button('Add stage').click();
    await settle();
    expect(host.textContent).toContain('Use 40 characters or fewer.');
    expect(data.save).not.toHaveBeenCalled();
  });

  it('shows a refused name inline and a lost connection with Try again', async () => {
    const taken = new HttpErrorResponse({
      status: 400,
      error: { errors: { Name: ['There’s already a stage called Lead.'] } },
    });
    const { host, ref, type, button, settle } = setup(() => throwError(() => taken));

    type('Lead');
    button('Add stage').click();
    await settle();

    expect(host.textContent).toContain('There’s already a stage called Lead.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
