# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Features

This deployment includes additional gameplay and telemetry features beyond the base Expo template:

- Mexican Dice gameplay (Quick Play & Survival modes)
- Global statistics (roll distribution, claims, wins, survival best & average)
- Survival streak dynamic UI (color & scale pulse with robust web fallback)
- Claim & event history with expandable modal (last 2 inline, full list modal)
- Cross-platform haptics (native Impact & Selection; web `navigator.vibrate` fallback)
- Persistent global data via Vercel KV (Upstash Redis)
- Menu-driven stats screen
- Theming with felt background + gold accent styles

### Haptics (Vibration) Support

Native iOS/Android use Expo Haptics for selection, light, medium, heavy, and double heavy feedback. Web browsers have limited vibration support (Safari iOS currently none). To avoid silent failures the `useHaptics` hook (`src/hooks/useHaptics.ts`) maps intents to `navigator.vibrate` patterns when available and otherwise gracefully no-ops.

Hook usage:

```ts
import { useHaptics } from './src/hooks/useHaptics';
const haptics = useHaptics();
haptics.selection();
haptics.light();
haptics.medium();
haptics.heavy();
haptics.doubleHeavy();
```

You can disable haptics by passing `useHaptics(true)` or extending the hook to read a persisted user preference (e.g., localStorage / AsyncStorage).
