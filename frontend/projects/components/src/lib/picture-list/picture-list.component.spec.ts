import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PictureListComponent, PictureListPhoto } from './picture-list.component';

@Component({
  imports: [PictureListComponent],
  template: `<ft-picture-list
    [photos]="photos()"
    [max]="max()"
    (picked)="picked.push($event)"
    (removed)="removed.push($event)"
    (featured)="featured.push($event)"
    (altChange)="alts.push($event)"
  />`,
})
class HostComponent {
  photos = signal<PictureListPhoto[]>([
    { url: '/1.jpg', alt: 'Grace at Builders Night', featured: true },
    { url: '/2.jpg', alt: 'The team', featured: false },
  ]);
  max = signal(10);
  picked: File[][] = [];
  removed: number[] = [];
  featured: number[] = [];
  alts: { index: number; alt: string }[] = [];
}

function file(name: string, type: string, bytes: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

async function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const host: HTMLElement = fixture.nativeElement;
  const all = <T extends Element>(s: string) => Array.from(host.querySelectorAll<T>(s));
  const q = <T extends Element>(s: string) => host.querySelector<T>(s);
  const buttonByName = (name: string) =>
    all<HTMLButtonElement>('button').find((b) => b.getAttribute('aria-label') === name)!;
  const addButton = () =>
    all<HTMLButtonElement>('button').find((b) => b.textContent?.includes('Add photos'))!;
  const choose = (files: File[]) => {
    const input = q<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  return { fixture, cmp: fixture.componentInstance, host, all, q, buttonByName, addButton, choose };
}

describe('PictureListComponent', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is a group named Photos with a count of the photos out of the maximum', async () => {
    const { q } = await setup();
    const group = q('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Photos');
    expect(group.textContent).toContain('2 of 10');
  });

  it('lists one thumbnail per photo using the description as alt text', async () => {
    const { all } = await setup();
    expect(all('li')).toHaveLength(2);
    expect(all<HTMLImageElement>('img').map((i) => i.alt)).toEqual([
      'Grace at Builders Night',
      'The team',
    ]);
  });

  it('marks the featured photo in words and offers Feature only on the others', async () => {
    const { host, buttonByName } = await setup();
    expect(host.querySelectorAll('li')[0].textContent).toContain('Featured');
    expect(host.querySelectorAll('li')[1].textContent).not.toContain('Featured');
    expect(buttonByName('Feature photo 1')).toBeUndefined();
    expect(buttonByName('Feature photo 2')).toBeDefined();
  });

  it('names each button after its photo and emits the index', async () => {
    const { cmp, buttonByName } = await setup();
    buttonByName('Feature photo 2').click();
    buttonByName('Remove photo 2').click();
    expect(cmp.featured).toEqual([1]);
    expect(cmp.removed).toEqual([1]);
  });

  it('returns focus to Add photos after a photo is removed', async () => {
    const { buttonByName, addButton } = await setup();
    buttonByName('Remove photo 1').click();
    expect(document.activeElement).toBe(addButton());
  });

  it('labels each description field and emits the changed text', async () => {
    const { fixture, cmp, host } = await setup();
    const input = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(host.querySelector('label[for="' + input.id + '"]')!.textContent).toContain(
      'Photo 1 description',
    );
    input.value = 'Grace speaking';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cmp.alts).toEqual([{ index: 0, alt: 'Grace speaking' }]);
  });

  it('asks for a description when one is missing', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.set([{ url: '/1.jpg', alt: '', featured: true }]);
    fixture.detectChanges();
    expect(host.textContent).toContain(
      'Describe what’s in the photo for people using screen readers.',
    );
  });

  it('emits accepted files', async () => {
    const { cmp, choose } = await setup();
    const a = file('a.jpg', 'image/jpeg', 1000);
    const b = file('b.webp', 'image/webp', 1000);
    choose([a, b]);
    expect(cmp.picked).toEqual([[a, b]]);
  });

  it('rejects an oversized file with a note naming the file and the limit', async () => {
    const { cmp, host, choose } = await setup();
    choose([file('team.jpg', 'image/jpeg', 9.4 * 1024 * 1024)]);
    expect(cmp.picked).toEqual([]);
    expect(host.textContent).toContain('team.jpg is 9.4 MB. Photos can be up to 5 MB');
  });

  it('rejects a file of the wrong type', async () => {
    const { cmp, host, choose } = await setup();
    choose([file('notes.pdf', 'application/pdf', 1000)]);
    expect(cmp.picked).toEqual([]);
    expect(host.textContent).toContain('notes.pdf');
    expect(host.textContent).toContain('JPEG, PNG or WebP');
  });

  it('shows a polite upload status on the uploading photo only', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.update((p) => [
      ...p,
      { url: '/3.jpg', alt: 'New', featured: false, state: 'uploading', progress: 60 },
    ]);
    fixture.detectChanges();
    expect(host.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(host.textContent).toContain('Uploading… 60%');
  });

  it('shows a photo-level error note', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.set([
      {
        url: '/1.jpg',
        alt: 'x',
        featured: true,
        state: 'failed',
        error: 'Upload failed. Try again.',
      },
    ]);
    fixture.detectChanges();
    expect(host.textContent).toContain('Upload failed. Try again.');
  });

  it('shows the empty message and no list when there are no photos', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.set([]);
    fixture.detectChanges();
    expect(host.textContent).toContain('No photos yet. Add one so people recognise you at events.');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('disables Add photos and explains when the maximum is reached', async () => {
    const { fixture, cmp, host, addButton } = await setup();
    cmp.max.set(2);
    fixture.detectChanges();
    expect(addButton().disabled).toBe(true);
    expect(host.textContent).toContain(
      'That’s 2 photos, the most a profile can have. Remove one to add another.',
    );
  });
});
