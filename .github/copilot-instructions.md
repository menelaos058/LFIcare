# Copilot Instructions for LFIcare Expo Project

## Project Overview
- **Type:** Expo React Native app (created with `create-expo-app`)
- **Main entry:** `App.js` and `app/index.tsx`
- **Routing:** File-based routing in the `app/` directory
- **Android Native:** Customizations in `android/` (see `build.gradle`, `MainActivity.kt`, etc.)
- **Firebase:** Configured via `firebaseConfig.js`

## Key Directories & Files
- `app/` — Main app screens/components (TypeScript, file-based routing)
- `components/` — Shared React components
- `screens/` — Individual screen components
- `services/` — Service layer (e.g., `AuthService.js`, `DatabaseService.js`)
- `utils/` — Utility functions
- `android/` — Native Android project files (custom Gradle tweaks, manifests)
- `assets/` — Fonts and images
- `firebaseConfig.js` — Firebase integration
- `tsconfig.json` — TypeScript config (strict mode, path alias `@/*` → project root)

## Developer Workflows
- **Install dependencies:** `npm install`
- **Start development server:** `npx expo start`
- **Reset project:** `npm run reset-project` (moves starter code to `app-example/`, creates blank `app/`)
- **Android builds:** Use Gradle files in `android/` for custom tweaks; see `0001-My-custom-Android-Gradle-tweaks.patch` for patching

## Patterns & Conventions
- **TypeScript:** Strict mode enabled; use `@/` alias for imports from project root
- **Routing:** Place screens/components in `app/` for automatic routing
- **Services:** Centralized in `services/` for authentication and database logic
- **Custom Android:** Native code and Gradle tweaks live in `android/`; patches may be applied for custom builds
- **Expo:** Follows Expo conventions for assets, config, and development

## Integration Points
- **Firebase:** All Firebase logic is in `firebaseConfig.js` and used by services
- **Native Android:** Customizations in `android/` may affect build and runtime; check for patches and custom manifests

## Examples
- Importing a component: `import Header from '@/components/Header'`
- Using a service: `import AuthService from '@/services/AuthService'`
- Adding a new screen: Create `app/NewScreen.tsx` for automatic routing

## Tips for AI Agents
- Respect file-based routing in `app/`
- Use path alias `@/` for imports
- Update Gradle or manifest files in `android/` for native changes
- Centralize business logic in `services/`
- Check for custom build steps or patches before modifying Android files

---
_If any section is unclear or missing, please provide feedback for further refinement._
