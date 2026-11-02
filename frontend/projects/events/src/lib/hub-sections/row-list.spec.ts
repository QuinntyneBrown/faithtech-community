// Traces to: L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { FormControl, FormGroup } from '@angular/forms';

import { RowList, clock, focusAfterRemove, numberOrNull, textOrNull } from './row-list';

const rules = () =>
  new RowList(
    () => new FormGroup({ title: new FormControl('', { nonNullable: true }) }),
    2,
    'Rule',
  );

describe('RowList', () => {
  it('numbers its rows and stops at its limit', () => {
    const list = rules();
    list.add({ title: 'Start fresh' });
    list.add();

    expect(list.heading(1)).toBe('Rule 02');
    expect(list.full).toBe(true);
    expect(list.add()).toBeNull();
    expect(list.count()).toBe(2);
  });

  it('moves a row up or down and removes it', () => {
    const list = rules();
    list.add({ title: 'Any stack' });
    list.add({ title: 'Start fresh' });

    list.move(1, -1);
    expect(list.array.getRawValue().map((r) => r.title)).toEqual(['Start fresh', 'Any stack']);
    list.move(0, -1);
    expect(list.array.at(0).value.title).toBe('Start fresh');

    list.remove(0);
    expect(list.array.getRawValue()).toEqual([{ title: 'Any stack' }]);
    expect(list.count()).toBe(1);
  });
});

describe('row values', () => {
  it('reads text, numbers and clock times as the API takes them', () => {
    expect(textOrNull('  Lament ')).toBe('Lament');
    expect(textOrNull('   ')).toBeNull();
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('90')).toBe(90);
    expect(clock(210)).toBe('3:30');
    expect(clock(180)).toBe('3:00');
  });
});

describe('focusAfterRemove', () => {
  function page(rows: string[]) {
    document.body.innerHTML = `
      <ol id="list">${rows
        .map((r) => `<ft-repeat-row><button>Remove</button><input id="${r}" /></ft-repeat-row>`)
        .join('')}</ol>
      <ft-button id="add"><button>Add a rule</button></ft-button>`;
    return {
      list: document.getElementById('list')!,
      add: document.getElementById('add')!,
    };
  }

  it('moves focus to the first field of the row that took the removed row’s place', () => {
    const { list, add } = page(['first', 'second']);
    focusAfterRemove(list, 1, add);
    expect(document.activeElement?.id).toBe('second');
  });

  it('moves focus to the Add button when no row follows', () => {
    const { list, add } = page(['first']);
    focusAfterRemove(list, 1, add);
    expect(document.activeElement?.textContent).toBe('Add a rule');

    focusAfterRemove(undefined, 0, add);
    expect(document.activeElement?.textContent).toBe('Add a rule');
  });
});
