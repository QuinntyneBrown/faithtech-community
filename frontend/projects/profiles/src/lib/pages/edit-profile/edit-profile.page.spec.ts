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
});
