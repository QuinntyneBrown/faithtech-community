import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ORGANISATION_SERVICE, OrganisationDto } from '@faithtech-community/api';
import { DialogService } from '@faithtech-community/components';
import { Observable, Subject, of, throwError } from 'rxjs';

import { EditGeneralSettingsDialog } from './edit-general-settings.dialog';

const organisation: OrganisationDto = {
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  chapterLabel: null,
  chapters: [],
  roles: [],
  partnerStages: [],
  eventTypes: [],
  resourceTypes: [],
  archivedResourceTypes: [],
};

const withCities: OrganisationDto = {
  ...organisation,
  chapterLabel: { singular: 'City', plural: 'Cities' },
  chapters: [{ id: 'c1', name: 'Toronto' }],
};

function setup(
  update: () => Observable<void> = () => of(undefined),
  current: OrganisationDto = organisation,
  confirmed: unknown = true,
) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { get: vi.fn(), update: vi.fn(update) };
  const dialogs = { open: vi.fn(() => ({ closed: of(confirmed) })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: current },
      { provide: DialogRef, useValue: ref },
      { provide: ORGANISATION_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
    ],
  });
  const fixture = TestBed.createComponent(EditGeneralSettingsDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const inputs = () =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input:not([role="switch"])'));
  const toggle = () => {
    host.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    fixture.detectChanges();
  };
  const type = (index: number, value: string) => {
    inputs()[index].value = value;
    inputs()[index].dispatchEvent(new Event('input'));
  };
  const save = () =>
    Array.from(host.querySelectorAll('button'))
      .find((b) => /^(Save settings|Try again)$/.test(b.textContent?.trim() ?? ''))!
      .click();
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, service, dialogs, inputs, toggle, type, save, settle };
}

describe('EditGeneralSettingsDialog', () => {
  it('starts from the current names and saves them trimmed, chapters staying off', async () => {
    const { inputs, type, save, settle, service, ref } = setup();
    expect(inputs().map((i) => i.value)).toEqual(['FaithTech Community', 'FaithTech']);
    type(1, '  FT  ');
    save();
    await settle();
    expect(service.update).toHaveBeenCalledWith({
      name: 'FaithTech Community',
      shortName: 'FT',
      chapterLabel: null,
    });
    expect(ref.close).toHaveBeenCalledWith('saved');
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

  it('turns chapters on with both labels, asking for the one that is missing', async () => {
    const { host, inputs, toggle, type, save, settle, service, ref } = setup();
    toggle();
    expect(inputs()).toHaveLength(4);
    type(2, ' Campus ');
    save();
    await settle();
    expect(host.textContent).toContain('Enter the plural label too.');
    expect(service.update).not.toHaveBeenCalled();

    type(3, 'Campuses');
    save();
    await settle();
    expect(service.update).toHaveBeenCalledWith({
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      chapterLabel: { singular: 'Campus', plural: 'Campuses' },
    });
    expect(ref.close).toHaveBeenCalledWith('saved');
  });

  it('keeps the label it starts with', async () => {
    const { inputs, save, settle, service } = setup(undefined, withCities);
    expect(inputs().map((i) => i.value)).toEqual([
      'FaithTech Community',
      'FaithTech',
      'City',
      'Cities',
    ]);
    save();
    await settle();
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ chapterLabel: { singular: 'City', plural: 'Cities' } }),
    );
  });

  it('asks before turning chapters off while chapters exist, and closes once they are off', async () => {
    const { toggle, save, settle, service, dialogs, ref } = setup(undefined, withCities, true);
    toggle();
    save();
    await settle();
    expect(dialogs.open).toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith('chapters-off');
  });

  it('stays open when the confirmation is declined', async () => {
    const { toggle, save, settle, ref } = setup(undefined, withCities, false);
    toggle();
    save();
    await settle();
    expect(ref.close).not.toHaveBeenCalled();
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
