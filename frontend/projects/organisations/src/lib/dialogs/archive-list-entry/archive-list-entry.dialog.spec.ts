import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ArchiveListEntryData, ArchiveListEntryDialog } from './archive-list-entry.dialog';

function setup(archive: () => Observable<unknown>, refusal: string | null = null) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: ArchiveListEntryData = {
    name: 'Prospect',
    description: 'An archived stage keeps no partners.',
    body: 'It leaves the partner board and every stage picker.',
    archiveLabel: 'Archive stage',
    refusal,
    fix: { href: '/partners', label: 'Open the partner board' },
    archive: vi.fn(archive),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(ArchiveListEntryDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, data, ref, button, settle };
}

describe('ArchiveListEntryDialog', () => {
  it('archives the entry and closes with true', async () => {
    const { host, data, ref, button, settle } = setup(() => of({}));

    expect(host.textContent).toContain('Archive Prospect?');
    button('Archive stage')!.click();
    await settle();

    expect(data.archive).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('explains a refusal known up front and offers only Close', () => {
    const { host, button } = setup(() => of({}), '3 partners are on this stage. Move them first.');

    expect(host.textContent).toContain('Can’t archive Prospect');
    expect(host.textContent).toContain('3 partners are on this stage. Move them first.');
    expect(host.querySelector('a')!.getAttribute('href')).toBe('/partners');
    expect(button('Archive stage')).toBeUndefined();
    expect(button('Close')).toBeTruthy();
  });

  it('shows the server refusal from a 409', async () => {
    const conflict = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Choose another initial stage first.' },
    });
    const { host, ref, button, settle } = setup(() => throwError(() => conflict));

    button('Archive stage')!.click();
    await settle();

    expect(host.textContent).toContain('Choose another initial stage first.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
