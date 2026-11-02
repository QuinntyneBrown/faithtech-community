import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  EventHubDto,
  EventHubsService,
  HubContentByKind,
  HubContentInputByKind,
  HubSectionKind,
  problemDetails,
} from '@faithtech-community/api';
import { Observable, firstValueFrom } from 'rxjs';

/**
 * A template whose default a wizard edits instead of a hub's section (L2-186 AC3, ADR 0043): its name, for the line saying
 * so, and where the content goes.
 */
export interface HubSectionTemplate {
  name: string;
  save<K extends HubSectionKind>(kind: K, content: HubContentInputByKind[K]): Observable<unknown>;
}

/**
 * What every section wizard opens with: the hub as the hub home read it, or, for a template, a stand-in hub and the
 * template it saves to.
 */
export interface HubSectionWizardData {
  hub: EventHubDto;
  template?: HubSectionTemplate;
}

/** A section's content as the hub read it. */
export function sectionContent<K extends HubSectionKind>(
  hub: EventHubDto,
  kind: K,
): HubContentByKind[K] | undefined {
  return hub.sections.find((s) => s.kind === kind)?.content as HubContentByKind[K] | undefined;
}

/** "Items[2].Title" as the wizard names its fields: "items[2].title". */
const fieldPath = (key: string) =>
  key.replace(/(^|\.)([A-Z])/g, (_, dot: string, letter: string) => dot + letter.toLowerCase());

/**
 * Saves one section from its wizard (L2-157 AC2 to AC4): busy while it runs; a 400 gives each message to the field that
 * caused it, keyed by path such as `items[2].title`; any other failure sets `failed` for "We couldn’t save this section".
 */
export class SectionSaver<K extends HubSectionKind> {
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly errors = signal<Record<string, string>>({});

  constructor(
    private readonly hubs: EventHubsService,
    private readonly eventId: string,
    private readonly kind: K,
    private readonly template?: HubSectionTemplate,
  ) {}

  error(path: string): string {
    return this.errors()[path] ?? '';
  }

  /** True once saved. */
  async save(content: HubContentInputByKind[K]): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.failed.set(false);
    this.errors.set({});
    try {
      await firstValueFrom(
        this.template
          ? this.template.save(this.kind, content)
          : this.hubs.saveSection(this.eventId, this.kind, content),
      );
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors ?? {};
        this.errors.set(
          Object.fromEntries(
            Object.entries(errors).map(([key, [first]]) => [fieldPath(key), first]),
          ),
        );
      } else {
        this.failed.set(true);
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
