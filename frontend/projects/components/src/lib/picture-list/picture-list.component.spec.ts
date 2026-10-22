import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PictureListComponent, PictureListPhoto } from './picture-list.component';

@Component({
  imports: [PictureListComponent],
  template: `<ft-picture-list
    [photos]="photos()"
    [max]="max()"
    [subject]="subject()"
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
  subject = signal<'profile' | 'contact'>('profile');
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

  it('leads Add photos with the add icon and Feature with the star, both decorative', async () => {
    const { addButton, buttonByName } = await setup();
    const add = addButton().querySelector('ft-icon svg')!;
    expect(add.getAttribute('aria-hidden')).toBe('true');
    expect(add.innerHTML).toContain('M12 5v14M5 12h14');
    const star = buttonByName('Feature photo 2').querySelector('ft-icon svg')!;
    expect(star.getAttribute('aria-hidden')).toBe('true');
    expect(star.innerHTML).toContain('m12 3 2.8 5.7');
    expect(addButton().textContent!.trim()).toBe('Add photos');
  });

  it('overlays the Featured badge on the featured thumbnail', async () => {
    const { host } = await setup();
    const badge = host.querySelectorAll('li')[0].querySelector('ft-badge')!;
    expect(badge.closest('.ft-photo__thumb')).not.toBeNull();
    expect(host.querySelectorAll('li')[1].querySelector('ft-badge')).toBeNull();
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

  it('uses the compact small field for each description', async () => {
    const { all } = await setup();
    const inputs = all<HTMLInputElement>('input[type="text"]');
    expect(inputs.length).toBe(2);
    for (const input of inputs) expect(input.classList).toContain('input--sm');
  });

  it('shows a saved photo that is still storing as a described placeholder with a status note', async () => {
    const { fixture, cmp, host, all } = await setup();
    cmp.photos.set([
      { id: 'a', url: null, alt: 'Grace at Builders Night', featured: true, storing: true },
      { id: 'b', url: null, alt: 'The team', featured: false, storing: true },
    ]);
    fixture.detectChanges();
    const items = all('li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      'Grace at Builders Night',
    );
    const statuses = Array.from(items[0].querySelectorAll('[role="status"]'));
    expect(statuses.map((n) => n.textContent).join(' ')).toContain(
      'Saved. It shows on your profile once it finishes storing.',
    );
    expect(host.textContent).toContain('Featured');
  });

  it('asks for a description when one is missing', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.set([{ url: '/1.jpg', alt: '', featured: true }]);
    fixture.detectChanges();
    expect(host.textContent).toContain(
      'Describe what’s in the photo for people using screen readers.',
    );
  });

  it('keeps the file input out of the page; Add photos opens it', async () => {
    const { q, addButton } = await setup();
    const input = q<HTMLInputElement>('input[type="file"]')!;
    const opened = vi.spyOn(input, 'click');
    expect(input.hidden).toBe(true);
    addButton().click();
    expect(opened).toHaveBeenCalled();
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

  it('names the upload progress bar after its photo', async () => {
    const { fixture, cmp, q } = await setup();
    cmp.photos.update((p) => [
      ...p,
      { url: '/3.jpg', alt: 'New', featured: false, state: 'uploading', progress: 60 },
    ]);
    fixture.detectChanges();
    expect(q('[role="progressbar"]')!.getAttribute('aria-label')).toBe('Uploading photo 3');
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

  it('marks a pending photo as not saved yet and offers no Feature for it', async () => {
    const { fixture, cmp, host, buttonByName } = await setup();
    cmp.photos.update((p) => [...p, { url: 'blob:3', alt: '', featured: false, pending: true }]);
    fixture.detectChanges();
    const item = host.querySelectorAll('li')[2];
    expect(item.textContent).toContain('Not saved yet. It uploads when you save your profile.');
    expect(buttonByName('Feature photo 3')).toBeUndefined();
    expect(item.textContent).not.toContain('Describe what’s in the photo');
  });

  it('shows the description error the page gives instead of its own check', async () => {
    const { fixture, cmp, host } = await setup();
    cmp.photos.set([{ url: '/1.jpg', alt: '', featured: true, altError: 'Describe this photo.' }]);
    fixture.detectChanges();
    expect(host.querySelector('ft-inline-message')!.textContent).toContain('Describe this photo.');
    cmp.photos.set([{ url: '/1.jpg', alt: '', featured: true, altError: '' }]);
    fixture.detectChanges();
    expect(host.querySelector('ft-inline-message')).toBeNull();
  });

  it('gives the id of each description field, for an error summary to link to', async () => {
    const { fixture, host } = await setup();
    const list = fixture.debugElement.children[0].componentInstance as PictureListComponent;
    const input = host.querySelectorAll<HTMLInputElement>('input[type="text"]')[1];
    expect(list.descriptionFieldId(1)).toBe(input.id);
  });

  it('disables Add photos and explains when the maximum is reached', async () => {
    const { fixture, cmp, host, addButton } = await setup();
    cmp.max.set(2);
    fixture.detectChanges();
    expect(addButton().disabled).toBe(true);
    const note = host.querySelector('#' + addButton().getAttribute('aria-describedby'))!;
    expect(note.textContent).toContain('the most a profile can have');
    expect(host.textContent).toContain(
      'That’s 2 photos, the most a profile can have. Remove one to add another.',
    );
  });

  describe('for a contact', () => {
    async function contactSetup(photos: PictureListPhoto[]) {
      const s = await setup();
      s.cmp.subject.set('contact');
      s.cmp.photos.set(photos);
      s.fixture.detectChanges();
      return s;
    }

    it('words its notes for a private contact', async () => {
      const { host } = await contactSetup([]);
      const text = host.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('No photos yet. Add one so you recognise them next time.');
      expect(text).toContain(
        'The featured photo shows on their card. Only you can see these photos.',
      );
    });

    it('says a contact holds at most ten photos', async () => {
      const { host, addButton } = await contactSetup(
        Array.from({ length: 10 }, (_, i) => ({
          url: `/${i}.jpg`,
          alt: `Photo ${i}`,
          featured: i === 0,
          pending: true,
        })),
      );
      expect(addButton().disabled).toBe(true);
      expect(host.textContent).toContain(
        'That’s 10 photos, the most a contact can have. Remove one to add another.',
      );
    });

    it('lets a chosen photo be featured before it is saved and says when it uploads', async () => {
      const { cmp, host, all } = await contactSetup([
        { url: '/1.jpg', alt: 'One', featured: true, pending: true },
        { url: '/2.jpg', alt: 'Two', featured: false, pending: true },
      ]);
      const feature = all<HTMLButtonElement>('button').find(
        (b) => b.getAttribute('aria-label') === 'Feature photo 2',
      )!;
      feature.click();
      expect(cmp.featured).toEqual([1]);
      expect(host.textContent).toContain('Not saved yet. It uploads when you save the contact.');
    });

    it('asks for a missing description in the server’s words', async () => {
      const { host } = await contactSetup([{ url: '/1.jpg', alt: '', featured: true }]);
      expect(host.textContent).toContain('Describe this photo.');
    });

    it('says a storing photo shows on the contact once stored', async () => {
      const { host } = await contactSetup([
        { url: null, alt: 'One', featured: true, storing: true },
      ]);
      expect(host.textContent).toContain('Saved. It shows here once it finishes storing.');
    });
  });
});
