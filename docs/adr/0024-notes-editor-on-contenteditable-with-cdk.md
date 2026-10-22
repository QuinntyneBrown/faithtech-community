# 0024. Notes: editor on contenteditable with the Angular CDK

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-022, L2-086, L2-087, L2-088, L2-089, L2-099
- Designs: `docs/detailed-designs/notes/block-editor`, `docs/detailed-designs/notes/pages-and-list`

## Context

Docs & notes needs a block editor: eleven block types, inline marks, links, markdown shortcuts, a slash menu, page-link autocomplete, reordering by drag and by keyboard, and a read-only view. `AGENTS.md` requires every reusable UI piece to live once in `components`, at WCAG 2.2 AA, with no HTTP in `components`, Angular CDK for overlays and dialogs, and no inline forms in pages.

The design had to settle whether to build the editor or adopt one, how it fits the "no inline forms" rule, how a keyboard or screen-reader user reorders blocks, and how formatting is captured without storing HTML.

## Decision

### Own editor in `components`, on contenteditable and the CDK

- `BlockEditorComponent` (`ft-block-editor`) lives in `components`. Each text block is its own `contenteditable` element; the block list is an Angular-rendered array, so block-level structure (type, order, insertion, deletion) is Angular state, and the browser edits only the text inside one block.
- Angular CDK provides the rest: `DragDropModule` for reordering by handle with a drop indicator, `Overlay` for the slash menu, page-link menu and formatting toolbar, `CdkMenu` (through `ft-menu`) for the block menu, `Dialog` (through `ft-dialog`) for every form, and `LiveAnnouncer` for move announcements.
- The editor takes blocks and two functions as inputs (`pageLinkSearch`, `imageSrc`) and emits changes and requests, so it has no HTTP calls and no dependency on `api`.
- Rejected: **ProseMirror and TipTap**. A schema-driven document model is more than one-owner block pages need; they add a large dependency with its own DOM ownership that fights Angular change detection; and their drag handles and menus would still need building to the design system and to WCAG 2.5.7. Rejected: **Quill**. It is a single rich-text field, not blocks, and its HTML-delta model does not map to the JSON block shape of ADR 0023. Rejected: **Editor.js**. It is block-based but plugin-driven, renders its own toolbars and menus outside the design system, and its keyboard and screen-reader support could not be brought to AA without forking it.

### A content editor is not a form

- The "no inline forms in pages" rule targets forms: fields, validation and a submit. The editing surface is a document being written, saved continuously, with no submit; it is a content editor, not a form.
- Every form the feature needs is a CDK dialog: share, page settings (title and icon), move, archive, restore, add image, add link and add link card. The page title is editable in place as the document's heading, and *Page settings* offers the same edit as a dialog.

### Keyboard alternative to dragging (WCAG 2.5.7)

- Every block has a handle button that is both the drag handle and the trigger of the block menu: *Turn into*, *Move up*, *Move down*, *Duplicate*, *Delete*.
- Alt+Shift+↑ and Alt+Shift+↓ move the focused block one position and keep the caret in it.
- A polite live region announces "Moved {block} to position {n} of {total}", and the edge case "already at position {n} of {total}".

### Formatting through a toolbar, shortcuts and a serializer

- A formatting toolbar appears over a selection (Bold, Italic, Underline, Strikethrough, Inline code, Link) with the shortcuts Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+S, Ctrl+E and Ctrl+K. Alt+F10 moves focus into the toolbar.
- `RichTextSerializer` converts between a block's DOM and its spans. It renders text nodes inside a fixed set of elements (`strong`, `em`, `u`, `s`, `code`, `a`) and never assigns `innerHTML`; it does not use `document.execCommand`. Paste inserts plain text only.
- Markdown shortcuts at the start of a block and the slash menu cover block types; `[[` opens page-link autocomplete.

## Consequences

- The editor is in-house code to maintain, with unit tests beside the serializer and the shortcuts and Playwright coverage of every interaction. In return there is no editor dependency, and the editor reads design tokens and meets the accessibility rules directly.
- One `contenteditable` per block keeps browser quirks local to a block. Selection across blocks (select-all-and-delete over several blocks) is limited to one block in v1.
- Undo across blocks relies on nothing but the browser's per-block history; a structural undo stack is deferred.
- Because content never travels as HTML, script injection through page content is closed at the serializer and again at `NoteBlocksValidator`.

## Deferred

Cross-block selection, a structural undo stack, nested list indentation, syntax highlighting in code blocks, embeds, and co-editing cursors.
