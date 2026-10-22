import { Locator, Page } from '@playwright/test';

/** One page at /notes/{id}: the editor, or the read-only view (docs/mocks/pages/note). */
export class NotePage {
  readonly heading: Locator;
  readonly title: Locator;
  readonly breadcrumb: Locator;
  readonly content: Locator;
  readonly blocks: Locator;
  readonly textBlocks: Locator;
  readonly retry: Locator;
  readonly slashMenu: Locator;
  readonly toolbar: Locator;
  readonly blockMenu: Locator;
  readonly announcement: Locator;
  readonly slashOptions: Locator;
  readonly saveStatus: Locator;
  readonly banner: Locator;
  readonly missing: Locator;
  readonly browse: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.title = page.getByRole('textbox', { name: 'Page title' });
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.content = page.getByRole('region', { name: 'Page content' });
    this.blocks = this.content.locator('.block');
    this.textBlocks = this.content.getByRole('textbox');
    this.retry = page.getByRole('button', { name: 'Retry' });
    this.blockMenu = page.getByRole('menu').last();
    this.announcement = page.locator('[data-move-announcement]');
    this.toolbar = page.getByRole('toolbar', { name: 'Formatting' });
    this.slashMenu = page.getByRole('listbox', { name: 'Insert a block' });
    this.slashOptions = this.slashMenu.getByRole('option');
    this.saveStatus = page.locator('ft-save-status');
    this.banner = page.locator('ft-banner');
    this.missing = page.getByRole('heading', { name: 'This page isn’t available' });
    this.browse = page.getByRole('link', { name: 'Browse notes' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/notes/${id}`);
  }

  textBlockNamed(type: string): Locator {
    return this.content.getByRole('textbox', { name: type, exact: true });
  }

  slashOption(name: string): Locator {
    return this.slashMenu.getByRole('option', { name: new RegExp(`^${name}`) });
  }

  toolbarButton(name: string): Locator {
    return this.toolbar.getByRole('button', { name, exact: true });
  }

  /** Selects the characters between two offsets of a text block, as a drag of the mouse would. */
  async select(index: number, start: number, end: number): Promise<void> {
    const block = this.textBlock(index);
    await block.focus();
    await block.evaluate(
      (el, [from, to]) => {
        const point = (at: number): [Node, number] => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let left = at;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const length = node.textContent?.length ?? 0;
            if (left <= length) return [node, left];
            left -= length;
          }
          return [el, el.childNodes.length];
        };
        const range = document.createRange();
        range.setStart(...point(from));
        range.setEnd(...point(to));
        const selection = getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      },
      [start, end],
    );
  }

  /** The drag handle of block `n` (1-based), "Move or open the menu for block n of total, type". */
  handle(n: number): Locator {
    return this.content.getByRole('button', {
      name: new RegExp(`^Move or open the menu for block ${n} of`),
    });
  }

  menuItem(name: string): Locator {
    return this.page.getByRole('menuitem', { name, exact: true });
  }

  /** Drags block `from` (1-based) by its handle onto block `to`'s place, in small steps as a person would. */
  async drag(from: number, to: number): Promise<void> {
    const handle = await this.handle(from).boundingBox();
    const target = await this.blocks.nth(to - 1).boundingBox();
    if (!handle || !target) throw new Error('Block not on screen');
    await this.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 10, {
      steps: 5,
    });
    await this.page.mouse.move(handle.x + handle.width / 2, target.y + 2, { steps: 20 });
    await this.page.mouse.up();
  }

  checkbox(name: string): Locator {
    return this.content.getByRole('checkbox', { name });
  }

  textBlock(index: number): Locator {
    return this.textBlocks.nth(index);
  }

  /** Focuses a text block and puts the caret after `offset` characters of its text. */
  async placeCaret(index: number, offset: number): Promise<void> {
    const block = this.textBlock(index);
    await block.focus();
    await block.evaluate((el, at) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = at;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.textContent?.length ?? 0;
        if (left <= length) {
          const range = document.createRange();
          range.setStart(node, left);
          range.collapse(true);
          const selection = getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        left -= length;
      }
    }, offset);
  }
}
