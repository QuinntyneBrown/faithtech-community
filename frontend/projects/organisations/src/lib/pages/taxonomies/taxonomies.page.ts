import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  EventTypeDto,
  ResourceTypeDto,
  ORGANISATION_SERVICE,
  OrganisationNames,
  PartnerStageDto,
  hasAny,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  ChipComponent,
  ChipGroupComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  MenuComponent,
  MenuEntry,
  ReorderableActionsDirective,
  ReorderableItem,
  ReorderableListComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  ArchiveListEntryData,
  ArchiveListEntryDialog,
  ListEntryNameData,
  ListEntryNameDialog,
} from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';
type Filter = 'active' | 'archived';

/**
 * The Stages & types tab at /organisation/taxonomies (L2-144 AC1, L2-145 AC1, L2-147 AC1), matching docs/mocks/pages/
 * organisation-taxonomies: the organisation's partner stages in board order with their partner counts, which is the
 * initial stage and each stage's kind, its event types in form order with their event counts, and its resource types
 * with their resource counts (L2-146 AC1); add, rename,
 * reorder and archive (plus set as initial and set the kind for stages) for holders of ManageOrganisationSettings,
 * read-only with ManageRoles (L2-147 AC2), and an Archived filter. The resource type keyed other is never archived.
 */
@Component({
  selector: 'ft-taxonomies-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    ChipGroupComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    MenuComponent,
    ReorderableActionsDirective,
    ReorderableListComponent,
    SkeletonComponent,
    StackComponent,
  ],
  providers: [DatePipe],
  templateUrl: './taxonomies.page.html',
  styleUrl: './taxonomies.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomiesPage {
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly names = inject(OrganisationNames);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly dates = inject(DatePipe);

  protected readonly state = signal<State>('loading');
  protected readonly filter = signal<Filter>('active');
  protected readonly stages = signal<PartnerStageDto[]>([]);
  protected readonly types = signal<EventTypeDto[]>([]);
  protected readonly resourceTypes = signal<ResourceTypeDto[]>([]);
  protected readonly canEdit = computed(() =>
    hasAny(this.auth.capabilities(), 'ManageOrganisationSettings'),
  );
  protected readonly rows = computed<ReorderableItem[]>(() =>
    this.stages().map((s) => ({
      id: s.id,
      title: s.name,
      meta: partners(s.partnerCount),
      badges: [
        ...(s.isInitial ? [{ label: 'Initial', variant: 'info' as const }] : []),
        s.kind === 'Confirmed'
          ? { label: 'Confirmed', variant: 'success' as const }
          : { label: 'Open' },
      ],
    })),
  );

  protected readonly typeRows = computed<ReorderableItem[]>(() =>
    this.types().map((t) => ({ id: t.id, title: t.name, meta: events(t.eventCount) })),
  );

  constructor() {
    void this.load();
  }

  protected show(filter: Filter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected archivedMeta(s: PartnerStageDto): string {
    const on = s.archivedAtUtc
      ? `Archived ${this.dates.transform(s.archivedAtUtc, 'EEE d MMM')}`
      : 'Archived';
    return `${on} · ${s.partnerCount === 0 ? 'no partners' : partners(s.partnerCount)}`;
  }

  protected archivedTypeMeta(t: EventTypeDto): string {
    const on = t.archivedAtUtc
      ? `Archived ${this.dates.transform(t.archivedAtUtc, 'EEE d MMM')}`
      : 'Archived';
    return `${on} · ${t.eventCount === 0 ? 'no events' : `${events(t.eventCount)} keep it`}`;
  }

  protected readonly resourceTypeRows = computed<ReorderableItem[]>(() =>
    this.resourceTypes().map((t) => ({
      id: t.id,
      title: t.name,
      meta: t.canArchive
        ? resources(t.resourceCount)
        : `${resources(t.resourceCount)} · Used when no other type fits; it can’t be archived`,
    })),
  );

  /** The other type's row menu: Rename only, as uploads fall back to it (L2-146 AC1). */
  protected readonly renameOnlyMenu: MenuEntry[] = [
    { kind: 'item', id: 'rename', label: 'Rename' },
  ];

  protected resourceTypeMenu(id: string): MenuEntry[] {
    return this.resourceTypes().find((t) => t.id === id)?.canArchive === false
      ? this.renameOnlyMenu
      : this.typeMenu;
  }

  protected archivedResourceTypeMeta(t: ResourceTypeDto): string {
    const on = t.archivedAtUtc
      ? `Archived ${this.dates.transform(t.archivedAtUtc, 'EEE d MMM')}`
      : 'Archived';
    if (t.resourceCount === 0) return `${on} · no resources`;
    return `${on} · ${resources(t.resourceCount)} ${t.resourceCount === 1 ? 'keeps' : 'keep'} it`;
  }

  protected actOnResourceType(item: ReorderableItem, action: string): void {
    const type = this.resourceTypes().find((t) => t.id === item.id);
    if (!type) return;
    if (action === 'rename') this.renameResourceType(type);
    if (action === 'archive') this.archiveResourceType(type);
  }

  protected addResourceType(): void {
    const data: ListEntryNameData<ResourceTypeDto> = {
      heading: 'Add a resource type',
      description:
        'It’s added at the end of the list and offered on the add and edit dialogs at once.',
      addLabel: 'Add type',
      save: (name) => this.organisations.addResourceType(name),
    };
    this.dialogs.open<ResourceTypeDto>(ListEntryNameDialog, { data }).closed.subscribe((added) => {
      if (!added) return;
      this.toasts.show({
        variant: 'success',
        heading: `${added.name} added`,
        text: 'It’s the last type on the add and edit dialogs.',
      });
      void this.load();
    });
  }

  /** Saved after each move; a failed save puts the order back. */
  protected async reorderResourceTypes(ids: string[]): Promise<void> {
    try {
      this.resourceTypes.set(await firstValueFrom(this.organisations.reorderResourceTypes(ids)));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Order not saved',
        text: this.names.unreachable('The order is as it was.'),
      });
      void this.load();
    }
  }

  private renameResourceType(type: ResourceTypeDto): void {
    const data: ListEntryNameData<ResourceTypeDto> = {
      heading: `Rename ${type.name}`,
      description:
        'Its resources, the add and edit dialogs and the Resources type filter show the new name.',
      name: type.name,
      save: (name) => this.organisations.renameResourceType(type.id, name),
    };
    this.dialogs
      .open<ResourceTypeDto>(ListEntryNameDialog, { data })
      .closed.subscribe((renamed) => {
        if (!renamed) return;
        this.toasts.show({
          variant: 'success',
          heading: `Renamed to ${renamed.name}`,
          text: 'Its resources and the dialogs show the new name.',
        });
        void this.load();
      });
  }

  private archiveResourceType(type: ResourceTypeDto): void {
    const n = type.resourceCount;
    const data: ArchiveListEntryData = {
      name: type.name,
      description: `Resources of type ${type.name} keep it, but it leaves the add and edit dialogs and the type filter.`,
      body:
        n === 0
          ? `No resources are of type ${type.name}.`
          : n === 1
            ? `1 resource is of type ${type.name}.`
            : `${n} resources are of type ${type.name}.`,
      archiveLabel: 'Archive type',
      archive: () => this.organisations.archiveResourceType(type.id),
    };
    this.dialogs.open<boolean>(ArchiveListEntryDialog, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${type.name} archived`,
        text:
          n === 0
            ? 'It’s listed under Archived.'
            : `Its ${resources(n)} ${n === 1 ? 'keeps' : 'keep'} the type. It’s listed under Archived.`,
      });
      void this.load();
    });
  }

  /** An event type's row menu: Rename and Archive (docs/mocks/pages/organisation-taxonomies). */
  protected readonly typeMenu: MenuEntry[] = [
    { kind: 'item', id: 'rename', label: 'Rename' },
    { kind: 'divider' },
    { kind: 'item', id: 'archive', label: 'Archive', danger: true },
  ];

  protected actOnType(item: ReorderableItem, action: string): void {
    const type = this.types().find((t) => t.id === item.id);
    if (!type) return;
    if (action === 'rename') this.renameType(type);
    if (action === 'archive') this.archiveType(type);
  }

  protected addType(): void {
    const data: ListEntryNameData<EventTypeDto> = {
      heading: 'Add an event type',
      description: 'It’s added at the end of the list and offered on the event form at once.',
      addLabel: 'Add type',
      save: (name) => this.organisations.addEventType(name),
    };
    this.dialogs.open<EventTypeDto>(ListEntryNameDialog, { data }).closed.subscribe((added) => {
      if (!added) return;
      this.toasts.show({
        variant: 'success',
        heading: `${added.name} added`,
        text: 'It’s the last type on the event form.',
      });
      void this.load();
    });
  }

  /** Saved after each move; a failed save puts the order back. */
  protected async reorderTypes(ids: string[]): Promise<void> {
    try {
      this.types.set(await firstValueFrom(this.organisations.reorderEventTypes(ids)));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Order not saved',
        text: this.names.unreachable('The order is as it was.'),
      });
      void this.load();
    }
  }

  private renameType(type: EventTypeDto): void {
    const data: ListEntryNameData<EventTypeDto> = {
      heading: `Rename ${type.name}`,
      description: 'Its events, the event form and the Events type filter show the new name.',
      name: type.name,
      save: (name) => this.organisations.renameEventType(type.id, name),
    };
    this.dialogs.open<EventTypeDto>(ListEntryNameDialog, { data }).closed.subscribe((renamed) => {
      if (!renamed) return;
      this.toasts.show({
        variant: 'success',
        heading: `Renamed to ${renamed.name}`,
        text: 'Its events and the event form show the new name.',
      });
      void this.load();
    });
  }

  private archiveType(type: EventTypeDto): void {
    const count =
      type.eventCount === 0
        ? `No events are of type ${type.name}.`
        : type.eventCount === 1
          ? `1 event is of type ${type.name}.`
          : `${type.eventCount} events are of type ${type.name}.`;
    const data: ArchiveListEntryData = {
      name: type.name,
      description: `Events of type ${type.name} keep it, but it leaves the event form and the type filter.`,
      body: count,
      archiveLabel: 'Archive type',
      archive: () => this.organisations.archiveEventType(type.id),
    };
    this.dialogs.open<boolean>(ArchiveListEntryDialog, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${type.name} archived`,
        text:
          type.eventCount === 0
            ? 'It’s listed under Archived.'
            : `Its ${events(type.eventCount)} keep the type. It’s listed under Archived.`,
      });
      void this.load();
    });
  }

  /** The row menu (docs/mocks/pages/organisation-taxonomies/row-menu). */
  protected menu(item: ReorderableItem): MenuEntry[] {
    const stage = this.stage(item);
    return [
      { kind: 'item', id: 'rename', label: 'Rename' },
      { kind: 'item', id: 'initial', label: 'Set as initial', disabled: stage?.isInitial },
      { kind: 'divider' },
      { kind: 'header', title: 'Counts as' },
      { kind: 'item', id: 'Open', label: 'Open', checked: stage?.kind === 'Open' },
      { kind: 'item', id: 'Confirmed', label: 'Confirmed', checked: stage?.kind === 'Confirmed' },
      { kind: 'divider' },
      { kind: 'item', id: 'archive', label: 'Archive', danger: true },
    ];
  }

  protected act(item: ReorderableItem, action: string): void {
    const stage = this.stage(item);
    if (!stage) return;
    switch (action) {
      case 'rename':
        return this.rename(stage);
      case 'initial':
        return void this.makeInitial(stage);
      case 'Open':
      case 'Confirmed':
        return void this.setKind(stage, action);
      case 'archive':
        return this.archive(stage);
    }
  }

  protected add(): void {
    const data: ListEntryNameData<PartnerStageDto> = {
      heading: 'Add a partner stage',
      description:
        'New stages count as open and are added at the end. Use the row menu to change that.',
      addLabel: 'Add stage',
      save: (name) => this.organisations.addPartnerStage(name),
    };
    this.dialogs.open<PartnerStageDto>(ListEntryNameDialog, { data }).closed.subscribe((added) => {
      if (!added) return;
      this.toasts.show({
        variant: 'success',
        heading: `${added.name} added`,
        text: 'It’s the last column on the partner board.',
      });
      void this.load();
    });
  }

  /** Saved after each move; a failed save puts the order back (docs/design-system/components/reorderable-list). */
  protected async reorder(ids: string[]): Promise<void> {
    try {
      this.stages.set(await firstValueFrom(this.organisations.reorderPartnerStages(ids)));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Order not saved',
        text: this.names.unreachable('The order is as it was.'),
      });
      void this.load();
    }
  }

  private rename(stage: PartnerStageDto): void {
    const data: ListEntryNameData<PartnerStageDto> = {
      heading: `Rename ${stage.name}`,
      description: 'The board column, partner pages and stage history show the new name.',
      name: stage.name,
      save: (name) => this.organisations.updatePartnerStage(stage.id, { name }),
    };
    this.dialogs
      .open<PartnerStageDto>(ListEntryNameDialog, { data })
      .closed.subscribe((renamed) => {
        if (!renamed) return;
        this.toasts.show({
          variant: 'success',
          heading: `Renamed to ${renamed.name}`,
          text: 'The board column and partner history show the new name.',
        });
        void this.load();
      });
  }

  private async makeInitial(stage: PartnerStageDto): Promise<void> {
    if (stage.isInitial) return;
    try {
      await firstValueFrom(this.organisations.updatePartnerStage(stage.id, { isInitial: true }));
      this.toasts.show({
        variant: 'success',
        heading: `${stage.name} is the initial stage`,
        text: `New partners start on ${stage.name}.`,
      });
      void this.load();
    } catch {
      this.notSaved();
    }
  }

  private async setKind(stage: PartnerStageDto, kind: 'Open' | 'Confirmed'): Promise<void> {
    if (stage.kind === kind) return;
    try {
      const saved = await firstValueFrom(this.organisations.updatePartnerStage(stage.id, { kind }));
      this.stages.update((list) => list.map((s) => (s.id === saved.id ? saved : s)));
    } catch {
      this.notSaved();
    }
  }

  private archive(stage: PartnerStageDto): void {
    const data: ArchiveListEntryData = {
      name: stage.name,
      description: 'An archived stage keeps no partners.',
      body: 'It leaves the partner board and every stage picker. Partner history shows it as archived.',
      archiveLabel: 'Archive stage',
      refusal:
        stage.partnerCount === 1
          ? '1 partner is on this stage. Move it first.'
          : stage.partnerCount > 1
            ? `${stage.partnerCount} partners are on this stage. Move them first.`
            : null,
      fix: { href: '/partners', label: 'Open the partner board' },
      archive: () => this.organisations.archivePartnerStage(stage.id),
    };
    this.dialogs.open<boolean>(ArchiveListEntryDialog, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${stage.name} archived`,
        text: 'It’s listed under Archived. Partner history shows it as archived.',
      });
      void this.load();
    });
  }

  private notSaved(): void {
    this.toasts.show({
      variant: 'danger',
      heading: 'Not saved',
      text: this.names.unreachable('Nothing was changed.'),
    });
  }

  private stage(item: ReorderableItem): PartnerStageDto | undefined {
    return this.stages().find((s) => s.id === item.id);
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    const archived = this.filter() === 'archived';
    try {
      const [stages, types, resourceTypes] = await Promise.all([
        firstValueFrom(this.organisations.listPartnerStages(archived)),
        firstValueFrom(this.organisations.listEventTypes(archived)),
        firstValueFrom(this.organisations.listResourceTypes(archived)),
      ]);
      this.stages.set(stages);
      this.types.set(types);
      this.resourceTypes.set(resourceTypes);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}

function partners(count: number): string {
  return count === 1 ? '1 partner' : `${count} partners`;
}

function events(count: number): string {
  return count === 1 ? '1 event' : `${count} events`;
}

function resources(count: number): string {
  return count === 1 ? '1 resource' : `${count} resources`;
}
