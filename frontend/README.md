# FaithTech Community frontend

Angular workspace for FaithTech Community. See [`AGENTS.md`](../AGENTS.md) for the architecture rules and [`SCAFFOLD.md`](SCAFFOLD.md) for the state of this workspace: it is currently a scaffold to be overwritten with the implementation.

## Commands

Run from `frontend/`:

| Command                                   | What it does                                        |
| ----------------------------------------- | --------------------------------------------------- |
| `npm install`                             | Install dependencies and the Husky pre-commit hook. |
| `npm start`                               | Serve the app at `http://localhost:4200/`.          |
| `npm run build`                           | Build the app.                                      |
| `npm run build:libs`                      | Build every library in dependency order.            |
| `npm test`                                | Run the unit tests (Vitest) for every project.      |
| `npm run lint`                            | Lint every project with angular-eslint.             |
| `npm run format` / `npm run format:check` | Format with Prettier / check formatting.            |

## Projects

| Project                                                                                                              | Package                           |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `faithtech-community`                                                                                                | The app                           |
| `components`                                                                                                         | `@faithtech-community/components` |
| `api`                                                                                                                | `@faithtech-community/api`        |
| `profiles`, `contacts`, `partners`, `team`, `events`, `search`, `notifications`, `announcements`, `invites`, `admin` | `@faithtech-community/<feature>`  |
