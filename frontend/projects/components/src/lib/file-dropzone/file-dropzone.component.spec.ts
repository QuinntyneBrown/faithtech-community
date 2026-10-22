import { TestBed } from '@angular/core/testing';

import { FileDropzoneComponent } from './file-dropzone.component';

describe('FileDropzoneComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(FileDropzoneComponent);
    fixture.componentRef.setInput('hint', 'Up to 20 files, 100 MB each.');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const chosen: File[][] = [];
    fixture.componentInstance.filesChosen.subscribe((files) => chosen.push(files));
    return { fixture, host, chosen };
  }

  it('is a labelled native file input described by the limits', () => {
    const { host } = setup();
    const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
    expect(input.closest('label')!.textContent).toContain('Drop files here or choose files');
    expect(host.querySelector(`#${input.getAttribute('aria-describedby')}`)!.textContent).toContain(
      'Up to 20 files',
    );
    expect(input.multiple).toBe(true);
  });

  it('emits dropped files and shows the drag state', () => {
    const { fixture, host, chosen } = setup();
    const zone = host.querySelector<HTMLElement>('.dropzone')!;
    const file = new File(['x'], 'deck.pptx');
    zone.dispatchEvent(
      Object.assign(new Event('dragover', { cancelable: true }), { dataTransfer: null }),
    );
    fixture.detectChanges();
    expect(zone.getAttribute('data-state')).toBe('dragover');
    zone.dispatchEvent(
      Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: { files: [file] } }),
    );
    expect(chosen).toEqual([[file]]);
  });
});
