import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';

import { TurnChaptersOffDialog, TurnChaptersOffData } from './turn-chapters-off.dialog';

function setup(submit: () => Promise<void> = async () => undefined) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: TurnChaptersOffData = {
    label: { singular: 'City', plural: 'Cities' },
    chapterCount: 4,
    submit: vi.fn(submit),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(TurnChaptersOffDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: RegExp) =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      name.test(b.textContent?.trim() ?? ''),
    )!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, data, ref, button, settle };
}

describe('TurnChaptersOffDialog', () => {
  it('says what is kept and turns the chapters off', async () => {
    const { host, button, data, ref, settle } = setup();
    expect(host.textContent).toContain('Turn cities off?');
    expect(host.textContent).toContain(
      'Members and events keep their city, but nothing will show it until you turn cities back on.',
    );
    expect(host.textContent).toContain('4 cities and every tag are kept.');
    expect(button(/^Keep cities on$/)).toBeTruthy();
    button(/^Turn cities off$/).click();
    await settle();
    expect(data.submit).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('keeps chapters on and offers Try again when the call fails', async () => {
    const { host, button, ref, settle } = setup(async () => {
      throw new Error('offline');
    });
    button(/^Turn cities off$/).click();
    await settle();
    expect(host.textContent).toContain('Cities are still on');
    expect(button(/^Try again$/)).toBeTruthy();
    expect(ref.close).not.toHaveBeenCalled();
  });
});
