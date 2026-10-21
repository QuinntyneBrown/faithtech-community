import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PROFILES_SERVICE, ProfileDto } from '@faithtech-community/api';
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
  SkeletonComponent,
  StackComponent,
  TextareaComponent,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Field = 'name' | 'homeCity' | 'bio';
type State = 'loading' | 'loaded' | 'error';

const FIELDS: Field[] = ['name', 'homeCity', 'bio'];
// The server's UpdateProfileValidator is the authority; these mirror it.
const MAX: Record<Field, number> = { name: 100, homeCity: 100, bio: 400 };
const TOO_LONG: Record<Field, string> = {
  name: 'Use 100 characters or fewer for your name.',
  homeCity: 'Use 100 characters or fewer for your home city.',
  bio: 'Use 400 characters or fewer for your bio.',
};

/** Edit your own name, home city and bio (L2-006), matching docs/mocks/pages/edit-profile. */
@Component({
  selector: 'ft-edit-profile-page',
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
    SkeletonComponent,
    StackComponent,
    TextareaComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-profile.page.html',
  styleUrl: './edit-profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfilePage {
  private readonly profiles = inject(PROFILES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly nameField = viewChild('nameField', { read: FormFieldComponent });
  private readonly homeCityField = viewChild('homeCityField', { read: FormFieldComponent });
  private readonly bioField = viewChild('bioField', { read: FormFieldComponent });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    homeCity: [''],
    bio: [''],
  });
  protected readonly state = signal<State>('loading');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  private readonly profile = signal<ProfileDto | null>(null);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });

  protected readonly summary = computed<FormError[]>(() =>
    this.errors().map((e) => ({ message: e.message, fieldId: this.fieldOf(e.field) })),
  );

  constructor() {
    void this.load();
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected load(): Promise<void> {
    this.state.set('loading');
    return firstValueFrom(this.profiles.getProfile('me')).then(
      (profile) => {
        this.profile.set(profile);
        this.form.setValue({
          name: profile.name,
          homeCity: profile.homeCity ?? '',
          bio: profile.bio ?? '',
        });
        this.state.set('loaded');
      },
      () => this.state.set('error'),
    );
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    const profile = this.profile();
    if (this.errors().length || this.busy() || !profile) return;

    this.busy.set(true);
    try {
      await firstValueFrom(this.profiles.updateProfile(profile.id, this.form.getRawValue()));
      this.toasts.show({
        variant: 'success',
        heading: 'Profile saved',
        text: 'Everyone signed in can now see your changes.',
      });
    } catch (error) {
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const value = this.form.controls[field].value.trim();
    if (field === 'name' && value === '') return 'Enter your name as you’d like people to see it.';
    return value.length > MAX[field] ? TOO_LONG[field] : '';
  }

  private fieldOf(field: Field): string {
    const formField = { name: this.nameField, homeCity: this.homeCityField, bio: this.bioField }[
      field
    ]();
    return formField?.controlId() ?? '';
  }
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
