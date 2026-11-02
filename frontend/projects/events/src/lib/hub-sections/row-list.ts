import { signal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * The rows of a hub section wizard (docs/mocks/dialogs/hub-rules and the other hackathon wizards): add up to a limit,
 * remove, and move up or down. Each row is a form group; `count` follows the rows so the template and live lines can
 * read it as a signal.
 */
export class RowList<C extends Record<string, AbstractControl>> {
  readonly array: FormArray<FormGroup<C>>;
  readonly count = signal(0);

  constructor(
    private readonly make: () => FormGroup<C>,
    readonly max: number,
    /** "Rule", for row headings such as "Rule 01". */
    private readonly noun: string,
  ) {
    this.array = new FormArray<FormGroup<C>>([]);
  }

  get rows(): FormGroup<C>[] {
    return this.array.controls;
  }

  get full(): boolean {
    return this.array.length >= this.max;
  }

  /** "Rule 01": the row's heading, numbered from one. */
  heading(index: number): string {
    return `${this.noun} ${String(index + 1).padStart(2, '0')}`;
  }

  /** Adds a row, filled from `value` when given; nothing past the limit. */
  add(value?: Parameters<FormGroup<C>['patchValue']>[0]): FormGroup<C> | null {
    if (this.full) return null;
    const row = this.make();
    if (value) row.patchValue(value);
    this.array.push(row);
    this.count.set(this.array.length);
    return row;
  }

  remove(index: number): void {
    this.array.removeAt(index);
    this.count.set(this.array.length);
  }

  /** Moves a row one place up (-1) or down (+1). */
  move(index: number, by: -1 | 1): void {
    const to = index + by;
    if (to < 0 || to >= this.array.length) return;
    const row = this.array.at(index);
    this.array.removeAt(index, { emitEvent: false });
    this.array.insert(to, row);
  }
}

/** Text as the API takes it: trimmed, or null when empty. */
export function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

/** A number field's value as the API takes it: a whole number, or null when empty. */
export function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** "3:30": seconds as minutes and seconds, as the demo's live line reads them. */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * After a row's Remove (design system, repeat list): focus the first field of the row now at `index` in `list`, or the
 * Add button (`add`, the `ft-button` host) when no row follows. Call it after the next render.
 */
export function focusAfterRemove(
  list: HTMLElement | undefined,
  index: number,
  add: HTMLElement | undefined,
): void {
  const row = list?.querySelectorAll('ft-repeat-row')[index];
  const field = row?.querySelector<HTMLElement>('input, textarea, select');
  (field ?? add?.querySelector('button'))?.focus();
}
