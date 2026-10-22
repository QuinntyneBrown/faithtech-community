import { TestBed } from '@angular/core/testing';
import { PROFILES_SERVICE, ProfileDto, ProfilesService } from '@faithtech-community/api';
import { of } from 'rxjs';

import { EditProfilePage } from './edit-profile.page';

const grace: ProfileDto = {
  id: 'p1',
  name: 'Grace Okonkwo',
  homeCity: null,
  bio: null,
  featuredPhoto: null,
  photos: [],
  roles: [],
  isOwn: true,
  canEdit: true,
};

describe('EditProfilePage', () => {
  it('links each summary error to its field', async () => {
    const service: Partial<ProfilesService> = {
      getProfile: () => of(grace),
      updateProfile: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PROFILES_SERVICE, useValue: service }],
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
      providers: [{ provide: PROFILES_SERVICE, useValue: { getProfile: () => of(grace) } }],
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
        providers: [{ provide: PROFILES_SERVICE, useValue: service }],
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
        homeCity: '',
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
