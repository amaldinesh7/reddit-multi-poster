# Tech Stack Rules

## Language & Frameworks
- **TypeScript**: ALWAYS use TypeScript in strict mode. No `any` types.
- **React**: Use functional components and hooks. Prefer composition over inheritance.
- **Next.js**: Follow Next.js 14+ patterns (App Router if applicable, or Pages Router as per current project structure).
- **Styling**: Tailwind CSS ONLY. No inline styles, no CSS-in-JS libraries.

## Code Quality
- **Type Safety**: Explicit interfaces for all data structures.
- **Modern JS**: Use `const` by default, `async/await`, destructuring, and spread operators.
- **Error Handling**: Use `try/catch` blocks for async operations and handle errors gracefully.
