# UI/UX Rules

## Design System
- **Shadcn UI**: ALWAYS prefer shadcn/ui components if available.
- **Tailwind**: Use Tailwind utility classes for all styling.
- **Icons**: Use `lucide-react` for icons.

## Styling Guidelines
- **Spacing**: Use semantic spacing (`gap-2`, `p-4`, `m-4`) from Tailwind's scale.
- **Colors**: Use semantic colors (`text-primary`, `bg-background`) to support theming (dark mode).
- **Consistency**: Match existing visual language.

## Interactivity
- **Feedback**: Loading states (spinners/skeletons) and empty states are MANDATORY.
- **Cursors**: Interactive elements must have `cursor-pointer`.
- **Accessibility**: Semantic HTML (`<button>`, `<a>`) and proper ARIA attributes.
