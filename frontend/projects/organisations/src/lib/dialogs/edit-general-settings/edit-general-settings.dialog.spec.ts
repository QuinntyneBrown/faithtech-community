import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ORGANISATION_SERVICE, OrganisationDto } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { EditGeneralSettingsDialog } from './edit-general-settings.dialog';

const organisation: OrganisationDto = {
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  chapterLabel: null,
  roles: [],
};

function setup(update: () => Observable<void> = () => of(undefined)) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { get: vi.fn(), update: vi.fn(update) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: organisation },
      { provide: DialogRef, useValue: ref },
      { provide: ORGANISATION_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(EditGeneralSettingsDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const inputs = () => Array.from(host.querySelectorAll('input'));
  const type = (index: number, value: string) => {
    inputs()[index].value = value;
    inputs()[index].dispatchEvent(new Event('input'));
  };
  const save = () =>
    Array.from(host.querySelectorAll('button'))
      .find((b) => /^(Save|Try again)$/.test(b.textContent?.trim() ?? ''))!
      .click();
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, service, inputs, type, save, settle };
}

describe('EditGeneralSettingsDialog', () => {
  it('starts from the current names and saves them trimmed', async () => {
    const { inputs, type, save, settle, service, ref } = setup();
    expect(inputs().map((i) => i.value)).toEqual(['FaithTech Community', 'FaithTech']);
    type(1, '  FT  ');
    save();
    await settle();
    expect(service.update).toHaveBeenCalledWith({ name: 'FaithTech Community', shortName: 'FT' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('refuses names past their limits without asking the server', async () => {
    const { host, type, save, settle, service } = setup();
    type(0, 'x'.repeat(101));
    type(1, 'y'.repeat(31));
    save();
    await settle();
    expect(service.update).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Use 100 characters or fewer for the name.');
    expect(host.textContent).toContain('Use 30 characters or fewer for the short name.');
  });

  it('shows the server’s field errors', async () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: { ShortName: ['That short name is taken.'] } },
    });
    const { host, save, settle, ref } = setup(() => throwError(() => error));
    save();
    await settle();
    expect(host.textContent).toContain('That short name is taken.');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('makes the fields read-only while saving', () => {
    const pending = new Subject<void>();
    const { fixture, inputs, save } = setup(() => pending);
    save();
    fixture.detectChanges();
    expect(inputs().every((i) => i.readOnly)).toBe(true);
  });
});
