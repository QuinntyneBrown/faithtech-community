namespace FaithTech.Community.Infrastructure.Events;

/// <summary>
/// The hub archive's one inline stylesheet (L2-197 AC6, ADR 0046): the design token roles it reads, with their light values and
/// their dark values (docs/design-system/tokens/tokens.css), then rules that read only the roles. The mocks in
/// docs/mocks/pages/hub-archive use the same text.
/// </summary>
internal static class HubArchiveStyles
{
    public const string Css = """
        :root {
          --color-bg-canvas: #f6f7f9;
          --color-bg-surface: #ffffff;
          --color-bg-surface-sunken: #eef0f3;
          --color-fg-default: #1a1e26;
          --color-fg-muted: #5e6675;
          --color-fg-link: #6d28d9;
          --color-border-default: #dfe3e8;
          --color-accent: #7c3aed;
          --color-fg-on-accent: #ffffff;
          --color-accent-subtle: #f5f3ff;
          --color-fg-accent: #6d28d9;
          --color-focus-ring: #7c3aed;
          --color-info-bg: #ebf2ff;
          --color-info-fg: #1e3fae;
          --color-info-border: #8ab4ff;
          --font-family-sans: ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
          --radius-md: 0.75rem;
          --radius-lg: 1.5rem;
          --radius-full: 9999px;
          color-scheme: light;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --color-bg-canvas: #0f1216;
            --color-bg-surface: #1a1e26;
            --color-bg-surface-sunken: #14181e;
            --color-fg-default: #e9ecf1;
            --color-fg-muted: #b3bac5;
            --color-fg-link: #c4b5fd;
            --color-border-default: #2f3640;
            --color-accent: #c4b5fd;
            --color-fg-on-accent: #2e1065;
            --color-accent-subtle: #2e1065;
            --color-fg-accent: #c4b5fd;
            --color-focus-ring: #c4b5fd;
            --color-info-bg: #0f1f3d;
            --color-info-fg: #adc6ff;
            --color-info-border: #1e3fae;
            color-scheme: dark;
          }
        }
        :root[data-theme="dark"] {
          --color-bg-canvas: #0f1216;
          --color-bg-surface: #1a1e26;
          --color-bg-surface-sunken: #14181e;
          --color-fg-default: #e9ecf1;
          --color-fg-muted: #b3bac5;
          --color-fg-link: #c4b5fd;
          --color-border-default: #2f3640;
          --color-accent: #c4b5fd;
          --color-fg-on-accent: #2e1065;
          --color-accent-subtle: #2e1065;
          --color-fg-accent: #c4b5fd;
          --color-focus-ring: #c4b5fd;
          --color-info-bg: #0f1f3d;
          --color-info-fg: #adc6ff;
          --color-info-border: #1e3fae;
          color-scheme: dark;
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--color-bg-canvas); color: var(--color-fg-default); font: 1rem/1.5 var(--font-family-sans); }
        a { color: var(--color-fg-link); }
        a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 0.25rem; }
        .skip-link { position: absolute; left: 1rem; top: -4rem; padding: 0.5rem 1rem; background: var(--color-bg-surface); border-radius: var(--radius-md); }
        .skip-link:focus { top: 1rem; }
        .archive { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
        h1, h2, h3 { line-height: 1.25; margin: 0; }
        h1 { font-size: clamp(1.75rem, 6vw, 2.25rem); }
        h2 { font-size: 1.5rem; margin-bottom: 0.75rem; }
        h3 { font-size: 1.125rem; }
        p { margin: 0; }
        .stack > * + * { margin-top: 0.5rem; }
        .overline { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-fg-muted); }
        .muted { color: var(--color-fg-muted); }
        .saved { margin: 1rem 0 0; padding: 0.75rem 1rem; border: 1px solid var(--color-info-border); border-radius: var(--radius-md); background: var(--color-info-bg); color: var(--color-info-fg); }
        .hero, .card { background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; }
        .hero { padding: 1.75rem 1.5rem; }
        main > section { margin-top: 2rem; }
        .rows { list-style: none; margin: 0; padding: 0; background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: var(--radius-md); }
        .rows > li { display: flex; gap: 1rem; align-items: flex-start; padding: 0.75rem 1rem; border-top: 1px solid var(--color-border-default); }
        .rows > li:first-child { border-top: 0; }
        .rows .lead { flex: none; min-width: 4.5rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .rows .end { margin-left: auto; flex: none; }
        .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
        .button { display: inline-block; padding: 0.5rem 1.25rem; border-radius: var(--radius-full); background: var(--color-accent); color: var(--color-fg-on-accent); font-weight: 600; text-decoration: none; }
        .avatar { width: 2.5rem; height: 2.5rem; flex: none; border-radius: var(--radius-full); object-fit: cover; display: grid; place-items: center; background: var(--color-accent-subtle); color: var(--color-fg-accent); font-weight: 600; font-size: 0.875rem; }
        img { max-width: 100%; height: auto; display: block; border-radius: var(--radius-md); }
        .plain { list-style: none; margin: 0; padding: 0; }
        figure { margin: 0; }
        figcaption { margin-top: 0.25rem; font-size: 0.875rem; color: var(--color-fg-muted); }
        .table { overflow-x: auto; background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: var(--radius-md); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; vertical-align: top; padding: 0.75rem 1rem; border-top: 1px solid var(--color-border-default); }
        thead th { border-top: 0; background: var(--color-bg-surface-sunken); font-size: 0.875rem; }
        footer { margin-top: 3rem; font-size: 0.875rem; color: var(--color-fg-muted); overflow-wrap: anywhere; }
        .actions { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
        caption { padding: 0.75rem 1rem; text-align: left; }
        @media (max-width: 40rem) {
          thead { display: none; }
          table, tbody, tr, th, td { display: block; }
          tbody tr { border-top: 1px solid var(--color-border-default); padding: 0.5rem 0; }
          tbody th, tbody td { border-top: 0; padding: 0.25rem 1rem; }
          td[data-label]::before { content: attr(data-label); display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-fg-muted); }
        }
        """;
}
