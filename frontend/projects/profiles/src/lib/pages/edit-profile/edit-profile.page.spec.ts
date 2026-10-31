import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ORGANISATION_SERVICE,
  PROFILES_SERVICE,
  ProfileDto,
  ProfilesService,
  SITE_SERVICE,
} from '@faithtech-community/api';
import { of } from 'rxjs';

import { EditProfilePage } from './edit-profile.page';

const grace: ProfileDto = {
  id: 'p1',
  name: 'Grace Okonkwo',
  chapterId: null,
  chapterName: null,
  bio: null,
  featuredPhoto: null,
  photos: [],
  roles: [],
  isOwn: true,
  canEdit: true,
};

/** FaithTech's chapters, read by the home chapter picker; null for an organisation with chapters off. */
function organisation(
  label: { singular: string; plural: string } | null = { singular: 'City', plural: 'Cities' },
) {
  return [
    {
      provide: ORGANISATION_SERVICE,
      useValue: {
        get: () =>
          of({
            name: 'FaithTech Community',
            shortName: 'FaithTech',
            chapterLabel: label,
            chapters: label
              ? [
                  { id: 'c-toronto', name: 'Toronto' },
                  { id: 'c-austin', name: 'Austin' },
                ]
              : [],
            roles: [],
          }),
      },
    },
    {
      provide: SITE_SERVICE,
      useValue: {
        site: signal({
          name: 'FaithTech Community',
          shortName: 'FaithTech',
          chapterLabel: label,
          communityOrigin: 'https://app.faithtech.test',
        }),
      },
    },
  ];
}

describe('EditProfilePage', () => {
  // Traces to: L2-141 AC1, L2-140 AC2, AC5
  describe('home chapter', () => {
    async function open(profile: ProfileDto, chapters = organisation()) {
      const service: Partial<ProfilesService> = {
        getProfile: () => of(profile),
        updateProfile: vi.fn(() => of(undefined)),
      };
      TestBed.configureTestingModule({
        providers: [{ provide: PROFILES_SERVICE, useValue: service }, ...chapters],
      });
      const fixture = TestBed.createComponent(EditProfilePage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return { service, fixture, host: fixture.nativeElement as HTMLElement };
    }

    it('picks from the active chapters, keeps an archived one the member already has, and saves the pick', async () => {
      const { service, fixture, host } = await open({
        ...grace,
        chapterId: 'c-regina',
        chapterName: 'Regina',
      });
      const select = host.querySelector<HTMLSelectElement>('select')!;
      const label = host.querySelector(`label[for="${select.id}"]`)!;

      expect(label.textContent).toContain('Home city');
      expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
        'No home city',
        'Toronto',
        'Austin',
        'Regina',
      ]);
      expect(select.value).toBe('c-regina');

      select.value = 'c-austin';
      select.dispatchEvent(new Event('change'));
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(service.updateProfile).toHaveBeenCalledWith('p1', {
        name: 'Grace Okonkwo',
        chapterId: 'c-austin',
        bio: '',
      });
    });

    it('has no picker while chapters are off', async () => {
      const { host } = await open(grace, organisation(null));

      expect(host.querySelector('select')).toBeNull();
      expect(host.textContent).not.toContain('Home city');
    });
  });

  it('links each summary error to its field', async () => {
    const service: Partial<ProfilesService> = {
      getProfile: () => of(grace),
      updateProfile: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PROFILES_SERVICE, useValue: service }, ...organisation()],
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const name = host.querySelector<HTMLInputElement>('input')!;

    name.value = ' ';
    name.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const link = host.querySelector<HTMLAnchorElement>('ft-error-summary a')!;
    expect(link.getAttribute('href')).toBe(`#${name.id}`);
    expect(service.updateProfile).not.toHaveBeenCalled();
  });

  it('caps the form at the large form width, as the mock does, leaving the header full width', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PROFILES_SERVICE, useValue: { getProfile: () => of(grace) } },
        ...organisation(),
      ],
    });
    const fixture = TestBed.createComponent(EditProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('form > ft-stack')!.classList).toContain('ft-stack--width-lg');
    expect(host.querySelector('ft-page-header')!.closest('.ft-stack--width-lg')).toBeNull();
  });

  // Traces to: L2-040 AC3, AC4
  describe('for another member', () => {
    const samuel: ProfileDto = { ...grace, id: 'p2', name: 'Samuel Mensah', isOwn: false };

    async function open(profile: ProfileDto) {
      const service: Partial<ProfilesService> = {
        getProfile: vi.fn(() => of(profile)),
        updateProfile: vi.fn(() => of(undefined)),
      };
      TestBed.configureTestingModule({
        providers: [{ provide: PROFILES_SERVICE, useValue: service }, ...organisation()],
      });
      const fixture = TestBed.createComponent(EditProfilePage);
      fixture.componentRef.setInput('id', 'p2');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return { service, host: fixture.nativeElement as HTMLElement, fixture };
    }

    it('loads and saves the target profile, not the caller’s', async () => {
      const { service, host, fixture } = await open(samuel);

      expect(service.getProfile).toHaveBeenCalledWith('p2');
      expect(host.querySelector('h1')!.textContent).toContain('Edit Samuel Mensah’s profile');
      expect(host.textContent).toContain(
        'You’re editing as System Admin. Every change is recorded in the audit log.',
      );
      const crumb = host.querySelector<HTMLAnchorElement>('ft-breadcrumb a')!;
      expect(crumb.textContent).toContain('Samuel Mensah');
      expect(crumb.getAttribute('href')).toBe('/people/p2');
      const cancel = Array.from(host.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Cancel',
      )!;
      expect(cancel.getAttribute('href')).toBe('/people/p2');

      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(service.updateProfile).toHaveBeenCalledWith('p2', {
        name: 'Samuel Mensah',
        chapterId: null,
        bio: '',
      });
    });

    it('shows the forbidden state and no form when the caller may not edit', async () => {
      const { host } = await open({ ...samuel, canEdit: false });

      expect(host.textContent).toContain('You can only edit your own profile');
      expect(host.textContent).toContain(
        'Ask a System Admin if Samuel Mensah’s profile needs a change.',
      );
      const back = Array.from(host.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Back to profile',
      )!;
      expect(back.getAttribute('href')).toBe('/people/p2');
      expect(host.querySelector('form')).toBeNull();
    });
  });
});
