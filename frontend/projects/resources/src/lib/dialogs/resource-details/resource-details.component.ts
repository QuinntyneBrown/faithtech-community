import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ORGANISATION_SERVICE,
  RESOURCES_SERVICE,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  CheckboxComponent,
  CheckboxGroupComponent,
  FormFieldComponent,
  PersonOption,
  PersonPickerComponent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SelectOption,
  TagInputComponent,
  TagSuggestion,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom, startWith } from 'rxjs';

import { ResourceDetailsForm } from './resource-details';

/**
 * The fields the add and edit dialogs share (L2-059, L2-061): title, description, type, tags and
 * who can see it, with the people and roles to share with. Batches hide title and type.
 */
@Component({
  selector: 'ft-resource-details',
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    CheckboxGroupComponent,
    FormFieldComponent,
    PersonPickerComponent,
    RadioComponent,
    RadioGroupComponent,
    SelectComponent,
    TagInputComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './resource-details.component.html',
  styleUrl: './resource-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceDetailsComponent implements OnInit {
  private readonly organisationRoles = inject(OrganisationRoles);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly organisation = inject(ORGANISATION_SERVICE);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  readonly form = input.required<ResourceDetailsForm>();
  readonly errors = input<Partial<Record<string, string>>>({});
  readonly showTitleAndType = input(true);
  /** "Guessed from .pdf — change it if it’s wrong." under the type, for one uploaded file. */
  readonly typeHint = input('');
  /** On edit, the resource's type: offered even once archived, until another is chosen (L2-146 AC2). */
  readonly currentType = input<{ key: string; name: string } | null>(null);

  private readonly titleField = viewChild<FormFieldComponent>('titleField');
  private readonly typeField = viewChild<FormFieldComponent>('typeField');

  protected readonly typeOptions = signal<SelectOption[]>([]);
  /** The resource's type when the organisation has archived it. */
  private readonly archivedType = signal<{ key: string; name: string } | null>(null);
  private readonly chosenType = signal('');
  protected readonly typeHelp = computed(() => {
    const archived = this.archivedType();
    return archived && this.chosenType() === archived.key
      ? `${archived.name} was archived. It stays on this resource until you choose another type.`
      : this.typeHint();
  });
  protected readonly roles = computed(() =>
    this.organisationRoles.roles().map((r) => ({ value: r.key, label: r.name })),
  );
  protected readonly tagSuggestions = signal<TagSuggestion[]>([]);
  protected readonly people = signal<PersonOption[]>([]);
  protected readonly searching = signal(false);

  protected readonly visibility = signal('Global');
  protected readonly titleLength = signal(0);

  ngOnInit(): void {
    const { visibility, title, type } = this.form().controls;
    type.valueChanges
      .pipe(startWith(type.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.chosenType.set(v));
    void this.loadTypes();
    visibility.valueChanges
      .pipe(startWith(visibility.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.visibility.set(v));
    title.valueChanges
      .pipe(startWith(title.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.titleLength.set(v.trim().length));
    void this.searchTags('');
  }

  private async loadTypes(): Promise<void> {
    try {
      const { resourceTypes } = await firstValueFrom(this.organisation.get());
      const options: SelectOption[] = resourceTypes.map((t) => ({ value: t.key, label: t.name }));
      const current = this.currentType();
      if (current && !resourceTypes.some((t) => t.key === current.key)) {
        options.push({ value: current.key, label: `${current.name} (archived)` });
        this.archivedType.set(current);
      }
      this.typeOptions.set(options);
    } catch {
      this.typeOptions.set([]);
    }
  }

  /** Ids of the fields the error summary links to. */
  fieldId(field: 'title' | 'type'): string | null {
    return (field === 'title' ? this.titleField() : this.typeField())?.controlId() ?? null;
  }

  /** "Change who can see it" opens the edit dialog here (L2-061 AC5). */
  focusVisibility(): void {
    this.host.querySelector<HTMLInputElement>('input[type=radio]:checked')?.focus();
  }

  protected async searchTags(q: string): Promise<void> {
    try {
      this.tagSuggestions.set(await firstValueFrom(this.resources.tags(q)));
    } catch {
      this.tagSuggestions.set([]);
    }
  }

  protected async searchPeople(q: string): Promise<void> {
    if (!q) {
      this.people.set([]);
      return;
    }
    this.searching.set(true);
    try {
      const members = await firstValueFrom(this.resources.members(q));
      this.people.set(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          detail: [m.roles.map((r) => this.organisationRoles.label(r)).join(', '), m.chapterName]
            .filter(Boolean)
            .join(' · '),
        })),
      );
    } catch {
      this.people.set([]);
    } finally {
      this.searching.set(false);
    }
  }
}
