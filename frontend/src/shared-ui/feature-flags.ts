/**
 * Feature Flag System for Shared UI Rollout (TypeScript wrapper)
 *
 * Usage:
 *   const { enabled } = useSharedUI();
 *   if (enabled) { ... } else { ... }
 *
 * Rollback:
 *   Set NEXT_PUBLIC_SHARED_UI_ENABLED=false or localStorage flag
 */

export const FEATURE_FLAGS = {
  SHARED_UI_ENABLED: 'shared_ui_enabled',
  SHARED_UI_SIMPLE_MODE: 'shared_ui_simple_mode',
} as const;

export function getFeatureFlag(flag: string, defaultValue = false): boolean {
  // Check environment variable first (server-side or build-time)
  if (typeof process !== 'undefined' && (process as any).env) {
    const envKey = `NEXT_PUBLIC_${flag.toUpperCase()}`;
    if ((process as any).env[envKey] !== undefined) {
      return (process as any).env[envKey] === 'true';
    }
  }

  // Check localStorage (client-side override)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(flag);
    if (stored !== null) {
      return stored === 'true';
    }
  }

  return defaultValue;
}

export function setFeatureFlag(flag: string, value: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(flag, String(value));
  }
}

export function useSharedUI() {
  const enabled = getFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, true); // default ON for new deployments
  const simpleMode = getFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE, true);

  return {
    enabled,
    simpleMode,
    toggle: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, !enabled),
    setSimpleMode: (value: boolean) => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE, value),
  };
}

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).sharedUIDebug = {
    enable: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, true),
    disable: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, false),
    status: () => ({
      enabled: getFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED),
      simpleMode: getFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE),
    }),
  };
  // eslint-disable-next-line no-console
  console.log('🎨 Shared UI debug: window.sharedUIDebug');
}
