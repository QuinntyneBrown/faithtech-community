import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { RESOURCES_SERVICE } from '@faithtech-community/api';
import { firstValueFrom } from 'rxjs';

/**
 * Image thumbnails fetched with the member's token and shown from object URLs, since no resource
 * blob has a public URL (ADR 0017). Provided per page; the URLs are revoked when it goes.
 */
@Injectable()
export class ThumbnailCache {
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly urls = signal<Record<string, string>>({});
  private readonly asked = new Set<string>();

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      Object.values(this.urls()).forEach((u) => URL.revokeObjectURL(u)),
    );
  }

  url(id: string): string | null {
    return this.urls()[id] ?? null;
  }

  load(resources: { id: string; hasThumbnail: boolean; isStored?: boolean }[]): void {
    for (const r of resources.filter(
      (r) => r.hasThumbnail && r.isStored !== false && !this.asked.has(r.id),
    )) {
      this.asked.add(r.id);
      void this.fetch(r.id);
    }
  }

  private async fetch(id: string): Promise<void> {
    try {
      const url = URL.createObjectURL(await firstValueFrom(this.resources.thumbnail(id)));
      this.urls.update((urls) => ({ ...urls, [id]: url }));
    } catch {
      // The type icon stays.
    }
  }
}
