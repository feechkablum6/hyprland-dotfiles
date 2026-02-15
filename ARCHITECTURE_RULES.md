# Architectural Constitution & Rules

This document establishes the strict architectural standards for this repository. All future development, refactoring, and AI agent contributions must adhere to these rules without exception.

## 1. Core Principles

*   **Strict Modularity**: Code must be broken down into small, single-purpose modules.
*   **Separation of Concerns**: UI (Widgets), Logic (Services), and Data/State must be decoupled.
*   **Type Safety**: TypeScript strict mode is mandatory. The `any` type is forbidden unless absolutely necessary and documented.
*   **Declarative UI**: Prefer declarative functional components over imperative DOM manipulation.

## 2. Directory Structure

The `ags/` directory is the primary application source. It must follow this structure:

```
ags/
├── app.ts              # Application entry point (main window composition)
├── widgets/            # Reusable UI components (buttons, sliders, popups)
│   ├── bar/            # Components specific to the top bar
│   ├── media/          # Components specific to the media player
│   └── common/         # Generic, shared UI components (Pill, Icon, etc.)
├── services/           # Business logic, system integrations, and state management
│   ├── audio.ts        # Audio/Volume control logic
│   ├── network.ts      # Network/WiFi logic
│   └── media.ts        # Media player logic
├── utils/              # Pure helper functions (formatting, parsing, etc.)
├── types/              # TypeScript type definitions and interfaces
└── styles/             # CSS/SCSS files
    ├── main.css        # Main stylesheet
    └── _variables.css  # CSS variables
```

## 3. Module Boundaries & Dependency Rules

*   **Widgets (`ags/widgets/`)**:
    *   CAN import: `services`, `utils`, `types`, `styles`, and other `widgets`.
    *   CANNOT import: `app.ts`.
    *   MUST be pure functional components where possible.
*   **Services (`ags/services/`)**:
    *   CAN import: `utils`, `types`.
    *   CANNOT import: `widgets`, `styles`, `app.ts`.
    *   MUST handle all side effects (executing commands, polling, signals).
    *   MUST expose reactive state or signals for Widgets to consume.
*   **Utils (`ags/utils/`)**:
    *   CAN import: `types`.
    *   CANNOT import: `widgets`, `services`, `styles`, `app.ts`.
    *   MUST be pure functions with no side effects.
*   **Styles (`ags/styles/`)**:
    *   CANNOT import any TypeScript code.

## 4. Naming Conventions

*   **Files**: `kebab-case.ts` (e.g., `media-player.ts`, `volume-control.ts`).
*   **React/AGS Components**: `PascalCase` (e.g., `MediaPopup`, `VolumeSlider`).
*   **Functions & Variables**: `camelCase` (e.g., `getVolume`, `isMuted`).
*   **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_VOLUME`, `DEFAULT_COVER_PATH`).
*   **Types & Interfaces**: `PascalCase` (e.g., `MediaTrack`, `NetworkState`).

## 5. Code Style & Limits

*   **File Length**:
    *   **Strict Limit**: 700 lines. Files exceeding this must be refactored immediately.
    *   **Recommended**: < 300 lines.
*   **State Management**:
    *   Do NOT use global variables for state.
    *   Use Astal/GJS signals, dedicated Service classes, or `Variable`/`Bind` objects.
*   **Hardcoding**:
    *   No hardcoded absolute paths (use `GLib.get_home_dir()` or relative paths).
    *   No magic numbers (extract to constants).
*   **Comments**:
    *   Public functions and complex logic must be documented with JSDoc.
    *   "Why" comments are preferred over "What" comments.

## 6. Anti-Patterns to Avoid

1.  **The "God Component"**: A single file (like the old `shell.tsx`) containing all logic, UI, and state.
2.  **Prop Drilling**: Passing data through too many layers. Use Services/Context instead.
3.  **Imperative Shell Commands in UI**: Widgets should not call `execAsync` directly. They should call a method on a Service (e.g., `AudioService.setVolume(50)` instead of `exec('wpctl ...')`).
4.  **Mixed Responsibilities**: A Widget should not know how to parse `wpctl` output. That belongs in a Service or Util.

## 7. Enforcement

*   All Pull Requests must be reviewed against this document.
*   Automated linters (ESLint) should be configured to enforce these rules where possible.
