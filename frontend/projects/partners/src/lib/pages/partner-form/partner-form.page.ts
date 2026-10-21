import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PARTNERS_SERVICE, PartnerDto, PartnerOwnerDto } from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  PageHeaderComponent,
  SelectComponent,
  SkeletonComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  EMAIL_MESSAGE,
  NAME_MESSAGE,
  PARTNER_FIELDS,
  PartnerField,
  clientErrors,
  fromPartner,
  ownerOptions,
  partnerForm,
  serverErrors,
  toRequest,
} from '../../partner-fields';

type State = 'loading' | 'loaded' | 'error' | 'read-only';

// The error summary words the client-side errors as short links (docs/mocks/pages/partner-form/invalid).
const SUMMARY: Record<string, string> = {
  [NAME_MESSAGE]: 'Enter the organisation’s name',
  [EMAIL_MESSAGE]: 'Enter a valid email',
};

/**
 * Edit a partner's details (L2-017, ADR 0007), matching docs/mocks/pages/partner-form. The stage
 * is not edited here; it changes only by a move.
 */
@Component({
  selector: 'ft-partner-form-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    PageHeaderComponent,
    SelectComponent,
    SkeletonComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './partner-form.page.html',
  styleUrl: './partner-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerFormPage {
  private readonly partners = inject(PARTNERS_SERVICE);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly nameField = viewChild('nameField', { read: FormFieldComponent });
  private readonly emailField = viewChild('emailField', { read: FormFieldComponent });

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly form = partnerForm(inject(FormBuilder));
  protected readonly state = signal<State>('loading');
  protected readonly partner = signal<PartnerDto | null>(null);
  private readonly owners = signal<PartnerOwnerDto[]>([]);
  protected readonly ownerOptions = computed(() => ownerOptions(this.owners()));
  protected readonly errors = signal<Partial<Record<PartnerField, string>>>({});
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly summary = computed<FormError[]>(() =>
    PARTNER_FIELDS.filter((f) => this.errors()[f]).map((f) => ({
      message: SUMMARY[this.errors()[f]!] ?? this.errors()[f]!,
      fieldId: (f === 'email' ? this.emailField() : this.nameField())?.controlId() ?? '',
    })),
  );

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected error(field: PartnerField): string {
    return this.errors()[field] ?? '';
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    this.failed.set(false);
    this.errors.set(clientErrors(value));
    if (Object.keys(this.errors()).length) {
      this.errorFocus()?.focusFirstError();
      return;
    }

    this.busy.set(true);
    try {
      await firstValueFrom(this.partners.update(this.id(), toRequest(value)));
      await this.router.navigateByUrl(`/partners/${this.id()}`);
    } catch (error) {
      const fields = serverErrors(error);
      if (fields) this.errors.set(fields);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const [partner, owners] = await Promise.all([
        firstValueFrom(this.partners.get(id)),
        firstValueFrom(this.partners.owners()),
      ]);
      this.partner.set(partner);
      this.owners.set(owners);
      this.form.setValue(fromPartner(partner));
      this.state.set(partner.canEdit ? 'loaded' : 'read-only');
    } catch {
      this.state.set('error');
    }
  }
}
