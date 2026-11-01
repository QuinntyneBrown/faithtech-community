import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  OrganisationNames,
  ResourceDto,
  RESOURCES_SERVICE,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  AvatarComponent,
  BannerComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
  SkeletonComponent,
  ToastService,
  avatarColorFor,
  formatDay,
  formatFileSize,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  ArchiveResourceDialog,
  EditResourceDialog,
  EditResourceData,
  TransferOwnershipDialog,
} from '../../dialogs';
import { fileOrHost, saveBlob, typeIcon, visibilityLine } from '../../resource-format';
import { ThumbnailCache } from '../../thumbnail-cache';

type State = 'loading' | 'loaded' | 'missing' | 'error';

/**
 * One resource (L2-056) with its preview, details, audience and the owner's or System Admin's
 * actions, as in docs/mocks/pages/resource. Anything the member may not open reads as missing.
 */
@Component({
  selector: 'ft-resource-page',
  imports: [
    AvatarComponent,
    BannerComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
    SkeletonComponent,
  ],
  providers: [ThumbnailCache],
  templateUrl: './resource.page.html',
  styleUrl: './resource.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcePage {
  private readonly organisationRoles = inject(OrganisationRoles);
  protected readonly organisation = inject(OrganisationNames);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  protected readonly thumbnails = inject(ThumbnailCache);

  protected readonly state = signal<State>('loading');
  protected readonly resource = signal<ResourceDto | null>(null);
  protected readonly restoring = signal(false);

  protected readonly typeIcon = typeIcon;
  protected readonly fileOrHost = fileOrHost;
  protected readonly visibilityLine = visibilityLine;
  protected readonly roleLabel = (key: string): string => this.organisationRoles.label(key);
  protected readonly formatDay = formatDay;
  protected readonly colorFor = avatarColorFor;

  protected readonly ownerName = computed(() => {
    const r = this.resource()!;
    return r.isOwn ? 'you' : r.ownerName;
  });
  protected readonly fileLine = computed(() => {
    const r = this.resource()!;
    return `${r.fileName} · ${r.extension!.toUpperCase()} · ${formatFileSize(r.size ?? 0)}`;
  });
  protected readonly downloadText = computed(() => {
    const r = this.resource()!;
    return `${r.extension!.toUpperCase()}, ${formatFileSize(r.size ?? 0)}`;
  });
  protected readonly sharedBanner = computed(() => {
    const r = this.resource()!;
    if (!r.sharedVia) return null;
    const who =
      r.sharedVia === 'you'
        ? 'you'
        : `everyone who has the ${this.organisationRoles.label(r.sharedVia)} role`;
    return `${r.ownerName} shared this with ${who}. You can open and download it, but not share it on.`;
  });

  constructor() {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected async download(): Promise<void> {
    const r = this.resource()!;
    try {
      saveBlob(await firstValueFrom(this.resources.download(r.id)), r.fileName!);
    } catch (error) {
      this.toasts.show({
        variant: 'danger',
        heading: `${r.title} didn’t download`,
        text:
          error instanceof HttpErrorResponse && error.status === 409
            ? 'This file is still uploading. Try again in a minute.'
            : `We couldn’t reach ${this.organisation.shortName()}. Try again.`,
      });
    }
  }

  protected async edit(focusVisibility = false): Promise<void> {
    const ref = this.dialogs.open<ResourceDto, EditResourceData>(EditResourceDialog, {
      data: { resource: this.resource()!, focusVisibility },
    });
    const saved = await firstValueFrom(ref.closed);
    if (!saved) return;
    this.resource.set(saved);
    this.thumbnails.load([saved]);
    this.toasts.show({ variant: 'success', heading: 'Changes saved', text: saved.title });
  }

  protected async archive(): Promise<void> {
    const r = this.resource()!;
    const ref = this.dialogs.open<string, ResourceDto>(ArchiveResourceDialog, { data: r });
    const purgeAt = await firstValueFrom(ref.closed);
    if (!purgeAt) return;
    this.toasts.show({
      variant: 'info',
      heading: `${r.title} archived`,
      text: `Restore it from Archived until ${formatDay(purgeAt)}.`,
      actionLabel: 'Undo',
      onAction: () => void this.restore(),
    });
    await this.router.navigate(['/resources']);
  }

  protected async transfer(): Promise<void> {
    const ref = this.dialogs.open<ResourceDto, ResourceDto>(TransferOwnershipDialog, {
      data: this.resource()!,
    });
    const saved = await firstValueFrom(ref.closed);
    if (!saved) return;
    this.resource.set(saved);
    this.toasts.show({
      variant: 'success',
      heading: 'Ownership transferred',
      text: `${saved.ownerName} owns ${saved.title} now.`,
    });
  }

  protected async restore(): Promise<void> {
    const r = this.resource()!;
    if (this.restoring()) return;
    this.restoring.set(true);
    try {
      await firstValueFrom(this.resources.restore(r.id));
      this.toasts.show({
        variant: 'success',
        heading: `${r.title} restored`,
        text: 'It’s back in Resources, with the same visibility as before.',
        actionLabel: 'View',
        onAction: () => void this.router.navigate(['/resources', r.id]),
      });
      await this.load();
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `${r.title} wasn’t restored`,
        text: `We couldn’t reach ${this.organisation.shortName()}. It’s still archived.`,
        actionLabel: 'Try again',
        onAction: () => void this.restore(),
      });
    } finally {
      this.restoring.set(false);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const resource = await firstValueFrom(this.resources.get(this.id));
      this.resource.set(resource);
      this.thumbnails.load([resource]);
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'missing' : 'error',
      );
    }
  }
}
