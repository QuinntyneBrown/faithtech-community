import { TestBed } from '@angular/core/testing';

import { FileRowComponent, FileRowStatus } from './file-row.component';

describe('FileRowComponent', () => {
  function setup(status: FileRowStatus, extra: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(FileRowComponent);
    fixture.componentRef.setInput('name', 'city-launch-deck.pptx');
    fixture.componentRef.setInput('meta', 'PPTX · 24.6 MB');
    fixture.componentRef.setInput('status', status);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('shows the name and meta with a Remove button named for the file', () => {
    const { host, fixture } = setup('ready');
    let removed = false;
    fixture.componentInstance.removed.subscribe(() => (removed = true));
    expect(host.textContent).toContain('PPTX · 24.6 MB');
    host.querySelector<HTMLButtonElement>('[aria-label="Remove city-launch-deck.pptx"]')!.click();
    expect(removed).toBe(true);
  });

  it('shows named progress while uploading and no Remove', () => {
    const { host } = setup('uploading', { progress: 40 });
    expect(host.querySelector('[role=progressbar]')!.getAttribute('aria-label')).toBe(
      'Uploading city-launch-deck.pptx',
    );
    expect(host.querySelector('[aria-label^="Remove"]')).toBeNull();
  });

  it('says why a file can’t be added', () => {
    const { host } = setup('refused', { error: 'setup.exe can’t be added.' });
    expect(host.textContent).toContain('Can’t add');
    expect(host.textContent).toContain('setup.exe can’t be added.');
  });

  it('marks finished and failed uploads', () => {
    expect(setup('uploaded').host.textContent).toContain('100% · Uploaded');
    expect(setup('failed').host.textContent).toContain('Didn’t upload');
  });
});
