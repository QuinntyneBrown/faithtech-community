import { FormControl, FormGroup } from '@angular/forms';
import {
  ResourceDto,
  ResourceFields,
  ResourceType,
  ResourceVisibility,
  Role,
} from '@faithtech-community/api';
import { PersonOption } from '@faithtech-community/components';

export type ResourceDetailsForm = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
  type: FormControl<ResourceType | ''>;
  tags: FormControl<string[]>;
  visibility: FormControl<ResourceVisibility>;
  members: FormControl<PersonOption[]>;
  roles: FormControl<string[]>;
}>;

export function detailsForm(resource?: ResourceDto): ResourceDetailsForm {
  return new FormGroup({
    title: new FormControl(resource?.title ?? '', { nonNullable: true }),
    description: new FormControl(resource?.description ?? '', { nonNullable: true }),
    type: new FormControl<ResourceType | ''>(resource?.type ?? '', { nonNullable: true }),
    tags: new FormControl<string[]>(resource?.tags ?? [], { nonNullable: true }),
    visibility: new FormControl<ResourceVisibility>(resource?.visibility ?? 'Global', {
      nonNullable: true,
    }),
    members: new FormControl<PersonOption[]>(
      (resource?.audience.members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        detail: m.chapterName,
      })),
      { nonNullable: true },
    ),
    roles: new FormControl<string[]>(
      (resource?.audience.roles ?? []).map((r) => r.role),
      { nonNullable: true },
    ),
  });
}

/** The field rules of L2-059, checked before the request; the server checks them again. */
export function detailErrors(
  form: ResourceDetailsForm,
  needsTitleAndType: boolean,
): Record<string, string> {
  const v = form.getRawValue();
  const errors: Record<string, string> = {};
  const title = v.title.trim();
  if (needsTitleAndType && !title) errors['title'] = 'Give it a title so people can find it.';
  else if (title.length > 120) errors['title'] = 'Use 120 characters or fewer for the title.';
  if (v.description.trim().length > 1000)
    errors['description'] = 'Use 1,000 characters or fewer for the description.';
  if (needsTitleAndType && !v.type) errors['type'] = 'Choose a type.';
  if (v.visibility === 'Shared' && v.members.length === 0 && v.roles.length === 0)
    errors['visibility'] = 'Choose at least one person or role, or pick another visibility.';
  return errors;
}

/** The request fields; batches leave out the title and type so each file supplies its own. */
export function fieldsOf(form: ResourceDetailsForm, withTitleAndType: boolean): ResourceFields {
  const v = form.getRawValue();
  const shared = v.visibility === 'Shared';
  return {
    title: withTitleAndType ? v.title.trim() : null,
    description: v.description.trim() || null,
    type: withTitleAndType ? v.type || null : null,
    tags: v.tags,
    visibility: v.visibility,
    memberIds: shared ? v.members.map((m) => m.id) : [],
    roles: shared ? (v.roles as Role[]) : [],
  };
}

/** Field errors from a 400 response, keyed as the form keys them. */
export function serverErrors(errors: Record<string, string[]> | undefined): Record<string, string> {
  const keys: Record<string, string> = {
    Title: 'title',
    Description: 'description',
    Type: 'type',
    Tags: 'tags',
    Visibility: 'visibility',
    MemberIds: 'visibility',
    Roles: 'visibility',
    Url: 'url',
    Files: 'files',
  };
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    result[keys[key] ?? key.toLowerCase()] = messages[0];
  }
  return result;
}
