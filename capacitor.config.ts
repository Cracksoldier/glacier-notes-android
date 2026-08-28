import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glacier.notes',
  appName: 'Glacier Notes',
  webDir: 'www',
  // Capacitor's bridge logger echoes every plugin call and result to logcat on
  // debug builds, which for the SQLite plugin means note titles and bodies.
  loggingBehavior: 'none',
};

export default config;
