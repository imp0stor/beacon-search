/**
 * Feature Flag System for Shared UI Rollout
 * 
 * Usage:
 *   const { enabled } = useSharedUI();
 *   if (enabled) { ... } else { ... }
 * 
 * Rollback:
 *   Set SHARED_UI_ENABLED=false in env or localStorage
 */

export const FEATURE_FLAGS = {
  SHARED_UI_ENABLED: 'shared_ui_enabled',
  SHARED_UI_SIMPLE_MODE: 'shared_ui_simple_mode',
};

export function getFeatureFlag(flag, defaultValue = false) {
  // Check environment variable first (server-side or build-time)
  if (typeof process !== 'undefined' && process.env) {
    const envKey = `NEXT_PUBLIC_${flag.toUpperCase()}`;
    if (process.env[envKey] !== undefined) {
      return process.env[envKey] === 'true';
    }
  }

  // Check localStorage (client-side override)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(flag);
    if (stored !== null) {
      return stored === 'true';
    }
  }

  return defaultValue;
}

export function setFeatureFlag(flag, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(flag, String(value));
  }
}

export function useSharedUI() {
  const enabled = getFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, true); // default ON for new deployments
  const simpleMode = getFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE, true);

  return {
    enabled,
    simpleMode,
    toggle: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, !enabled),
    setSimpleMode: (value) => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE, value),
  };
}

// Debug helper
if (typeof window !== 'undefined') {
  window.sharedUIDebug = {
    enable: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, true),
    disable: () => setFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED, false),
    status: () => ({
      enabled: getFeatureFlag(FEATURE_FLAGS.SHARED_UI_ENABLED),
      simpleMode: getFeatureFlag(FEATURE_FLAGS.SHARED_UI_SIMPLE_MODE),
    }),
  };
  console.log('🎨 Shared UI debug: window.sharedUIDebug');
}
