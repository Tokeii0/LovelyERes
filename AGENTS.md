# LovelyRes Development Guide

This repository hosts the LovelyRes codebase, a cross-platform Linux Emergency Response Tool built with **Tauri v2** (Rust backend) and **Vue 3 + TypeScript** (Frontend).

## 🛠 Project Structure
- **Frontend**: `src/` (Vue 3, TypeScript, Vite)
  - Entry point: `src/main.ts`
  - Core logic: `src/modules/`
  - Styles: `src/css/`, `src/styles/`
- **Backend**: `src-tauri/` (Rust)
  - Core logic: `src-tauri/src/`
  - Cargo config: `src-tauri/Cargo.toml`

## 🚀 Build & Test Commands

### Prerequisites
- Node.js (v18+) & pnpm/npm
- Rust (stable)

### Commands
| Action | Command | Description |
|--------|---------|-------------|
| **Dev** | `npm run tauri dev` | Start frontend & backend in dev mode |
| **Build** | `npm run tauri build` | Build production application |
| **Lint** | `npm run build` | Runs `vue-tsc` (Type check) & Vite build |
| **Test** | *See notes below* | Currently no dedicated test runner configured |

> **Note on Tests**: The project currently lacks a standardized test suite (Jest/Vitest). When adding tests, prefer **Vitest** for Vue/TS and **Rust's built-in test framework** (`cargo test`) for backend logic.

## 🎨 Code Style & Conventions

### General
- **Indentation**: 2 spaces (Frontend), 4 spaces (Rust).
- **Line Endings**: LF.
- **File Naming**:
  - TS/JS: `camelCase.ts` (e.g., `stateManager.ts`)
  - Vue: `PascalCase.vue` (e.g., `SSHTerminal.vue`)
  - Rust: `snake_case.rs`
- **Comments**: minimal, explanatory "why" comments. Use JSDoc/RustDoc for public APIs.

### Frontend (Vue/TS)
- **Framework**: Vue 3 Composition API (`<script setup lang="ts">`).
- **Imports**:
  - Group imports: External (vue, tauri) -> Internal Modules -> Styles.
  - Avoid circular dependencies in `src/modules/`.
- **Typing**: Strict TypeScript. Avoid `any` where possible (though legacy code uses it).
  - Define interfaces in `src/types.ts` or local module files.
- **State Management**: use `StateManager` class pattern (observable/reactive) or Vue's `ref/reactive`.
- **UI Components**: Manual DOM manipulation is present in legacy code (e.g., `document.createElement`), but prefer Vue components for new features.
- **Async/Await**: Always use async/await for Tauri commands (`invoke`).

### Backend (Rust)
- **Crates**: `tauri`, `russh` (SSH), `tokio` (Async), `serde` (JSON).
- **Error Handling**: Use `anyhow` or `thiserror`. Return `Result<T, String>` for Tauri commands to handle errors gracefully in frontend.
- **Async**: Heavy usage of `tokio` for async SSH and I/O.

### 🛡 Safety & Security
- **Secrets**: NEVER commit `.env`, private keys, or credentials.
- **Tauri Commands**: Validate all inputs from frontend in Rust.
- **Permissions**: Check `capabilities` in `src-tauri/capabilities/` when adding new plugins.

## 🤖 Agent Instructions
- **Modifying UI**: Check `src/modules/ui/` for existing renderers (e.g., `modernUIRenderer.ts`) before creating new ones.
- **Adding Features**:
  1. Define Rust command in `src-tauri/src/lib.rs` (or modules).
  2. Expose via `invoke` in Frontend `src/apiService.ts` or specific manager.
  3. Update UI to trigger the command.
- **Refactoring**: Be careful with global window objects (`(window as any).app`). Legacy code relies heavily on them.
