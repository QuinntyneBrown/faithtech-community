import { TestBed } from '@angular/core/testing';

import { WorkspacesPage } from './workspaces.page';

describe('WorkspacesPage', () => {
  it('is headed Workspaces', () => {
    const fixture = TestBed.createComponent(WorkspacesPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Workspaces');
  });
});
