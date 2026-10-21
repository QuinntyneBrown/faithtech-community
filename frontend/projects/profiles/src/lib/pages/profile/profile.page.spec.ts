import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PROFILES_SERVICE, ProfileDto, ProfilesService } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ProfilePage } from './profile.page';

const samuel: ProfileDto = {
  id: 'p1',
  name: 'Samuel Mensah',
  homeCity: 'Toronto',
  bio: null,
  featuredPhoto: null,
  photos: [],
  roles: ['CreateLead'],
  isOwn: false,
  canEdit: false,
};

function setup(getProfile: (id: string) => Observable<ProfileDto>) {
  const service: Partial<ProfilesService> = { getProfile: vi.fn(getProfile) };
  TestBed.configureTestingModule({ providers: [{ provide: PROFILES_SERVICE, useValue: service }] });
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.componentRef.setInput('id', 'p1');
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, service };
}

describe('ProfilePage', () => {
  it('shows role labels and no bio prompt on someone else’s profile', async () => {
    const { fixture, host } = setup(() => of(samuel));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('h1')!.textContent).toContain('Samuel Mensah');
    expect(host.textContent).toContain('Create Lead');
    expect(host.textContent).not.toContain('You haven’t written a bio yet.');
    expect(host.textContent).not.toContain('Edit profile');
  });

  it('tells a 404 apart from a failure', async () => {
    const { fixture, host } = setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('We can’t find that profile');
    expect(host.textContent).not.toContain('We couldn’t load this profile');
  });
});
