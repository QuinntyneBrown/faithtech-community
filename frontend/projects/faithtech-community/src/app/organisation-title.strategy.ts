import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { OrganisationNames } from '@faithtech-community/api';

/**
 * Titles every route "{page} · {organisation short name}", or the short name alone for a route without a title
 * (L2-134 AC2). It follows the short name, so the title is right once /api/me or /api/site has loaded.
 */
@Injectable()
export class OrganisationTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly names = inject(OrganisationNames);
  private readonly page = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const page = this.page();
      const shortName = this.names.shortName();
      this.title.setTitle(page ? `${page} · ${shortName}` : shortName);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.page.set(this.buildTitle(snapshot));
  }
}
