# Architecture Rules

## Separation of Concerns (CRITICAL)
- **UI Components**: Presentational ONLY. Should not contain business logic or direct API calls.
- **Hooks/Services**: Business logic and state management.
- **API Layer**: ALL external API calls must be wrapped in dedicated service functions in `lib/api/`.
- **Components**: Composition layer.

## File Organization
- **Modularity**: Soft limit of 200 lines per file. Break down large components.
- **Atomic Design**: Reusable UI components in `components/ui` (shadcn-like).
- **Feature Folders**: Group related files by feature if possible.

## Data Flow
- ❌ NO API calls directly inside JSX/Components.
- ❌ NO data mutation inside render.
- ✅ Use dedicated hooks for data fetching (e.g., `useSubreddits`).
