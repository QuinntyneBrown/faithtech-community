import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CONTACTS_SERVICE, ContactDto } from '@faithtech-community/api';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** One private contact (L2-012, L2-013), matching docs/mocks/pages/contact. */
@Component({
  selector: 'ft-contact-page',
  imports: [
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    LinkComponent,
    PageHeaderComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
  ],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  private readonly contacts = inject(CONTACTS_SERVICE);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly contact = signal<ContactDto | null>(null);

  protected readonly subtitle = computed(() => {
    const contact = this.contact();
    if (!contact) return '';
    if (contact.linkedProfileId) return 'Member · linked profile';
    return contact.isOwn
      ? 'Private contact · only you can see this'
      : 'Another lead’s private contact · your access is recorded';
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      this.contact.set(await firstValueFrom(this.contacts.get(id)));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
