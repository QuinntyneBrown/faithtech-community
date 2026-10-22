// Traces to: L2-085
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerActivityDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { LogActivityData, LogActivityDialog, localToday } from './log-activity.dialog';

const data: LogActivityData = { partnerId: 'x1', name: 'Kestrel Labs' };

function setup(log: () => Observable<PartnerActivityDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { logActivity: vi.fn(log) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: PARTNERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(LogActivityDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const type = (value: string, selector: string) => {
    const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const inputs = () => Array.from(host.querySelectorAll<HTMLInputElement>('input.input'));
  const primary = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      /^(Log|Try again)/.test(b.textContent!.trim()),
    )!;
  const save = async () => {
    primary().click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, type, inputs, primary, save };
}

const logged = { id: 'a1', kind: 'Call' } as PartnerActivityDto;

describe('LogActivityDialog', () => {
  it('defaults to a call today and names the partner', () => {
    const { host, inputs, primary } = setup(() => of(logged));

    expect(host.textContent).toContain('Log activity for Kestrel Labs');
    expect(host.textContent).toContain('Every lead sees this on Kestrel Labs’s timeline.');
    expect(inputs()[0].value).toBe(localToday());
    expect(inputs()[0].getAttribute('max')).toBe(localToday());
    expect(primary().textContent!.trim()).toBe('Log call');
  });

  it('sends the trimmed activity and closes with it', async () => {
    const { ref, service, type, save } = setup(() => of(logged));

    type(' Called Nadia. ', 'textarea');
    type('14:15', 'input[type="time"]');
    type(' Send wording ', 'input[type="text"]');
    await save();

    expect(service.logActivity).toHaveBeenCalledWith('x1', {
      kind: 'Call',
      summary: 'Called Nadia.',
      occurredOn: localToday(),
      occurredAt: '14:15',
      nextStep: 'Send wording',
      nextStepDue: null,
    });
    expect(ref.close).toHaveBeenCalledWith(logged);
  });

  it('shows the client errors and sends nothing', async () => {
    const { host, service, type, save } = setup(() => of(logged));

    type('2999-01-01', 'input[type="date"]');
    await save();

    expect(host.textContent).toContain('Say what happened, in a sentence or two.');
    expect(host.textContent).toContain('Choose today or an earlier date.');
    expect(service.logActivity).not.toHaveBeenCalled();
  });

  it('maps the API’s field errors and keeps the dialog open', async () => {
    const { host, ref, type, save } = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { NextStep: ['Use 200 characters or fewer for the next step.'] } },
          }),
      ),
    );

    type('Called Nadia.', 'textarea');
    await save();

    expect(host.textContent).toContain('Use 200 characters or fewer for the next step.');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('keeps the input and offers Try again when the save fails', async () => {
    const { host, ref, type, save, primary } = setup(() =>
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );

    type('Called Nadia.', 'textarea');
    await save();

    expect(host.textContent).toContain('Activity not logged');
    expect(host.querySelector('textarea')!.value).toBe('Called Nadia.');
    expect(primary().textContent!.trim()).toBe('Try again');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
