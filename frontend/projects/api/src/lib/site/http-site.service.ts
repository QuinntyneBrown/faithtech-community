import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_SERVER_ERROR } from '../errors';
import { Site, SiteService } from './site.service';

@Injectable()
export class HttpSiteService implements SiteService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly loaded = signal<Site | null>(null);

  readonly site = this.loaded.asReadonly();

  async load(): Promise<void> {
    try {
      const site = await firstValueFrom(
        this.http.get<Site>(`${this.api}/site`, {
          // The app still starts without it; the names fall back (OrganisationNames).
          context: new HttpContext().set(HANDLES_SERVER_ERROR, true),
        }),
      );
      this.loaded.set(site);
    } catch {
      this.loaded.set(null);
    }
  }
}
