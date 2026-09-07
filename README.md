# easymd

Markdown editor powered by Tauri + React + Vite.

## Development

```bash
pnpm install
pnpm tauri dev    # launches desktop app
pnpm test         # runs Vitest
pnpm build        # type-check + bundle frontend
```

## Stack

- Frontend: React 18 + Vite 5 + TypeScript 5
- Backend: Rust (Tauri 2)
- Tests: Vitest + Testing Library
- Lint/Format: ESLint + Prettier