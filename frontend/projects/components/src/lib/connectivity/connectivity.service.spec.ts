import { TestBed } from '@angular/core/testing';
import { ConnectivityService } from './connectivity.service';

function setNavigatorOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('ConnectivityService', () => {
  afterEach(() => vi.restoreAllMocks());
  const create = () => TestBed.inject(ConnectivityService);

  it('starts online when the browser reports online', () => {
    setNavigatorOnline(true);
    const c = create();
    expect(c.online()).toBe(true);
    expect(c.offline()).toBe(false);
  });

  it('starts offline when the browser reports offline', () => {
    setNavigatorOnline(false);
    expect(create().online()).toBe(false);
  });

  it('follows offline and online events', () => {
    setNavigatorOnline(true);
    const c = create();
    window.dispatchEvent(new Event('offline'));
    expect(c.online()).toBe(false);
    expect(c.offline()).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(c.online()).toBe(true);
  });
});
