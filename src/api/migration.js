/**
 * Migration API - Handles localStorage to chrome.storage migration
 * One-time migration when upgrading from MV2 to MV3
 */

import { registerHandlers } from './messaging.js';

const MIGRATION_KEY = 'mv3-migration-complete';
const MIGRATE_PREFIXES = ['style/'];

// Keys that need to be migrated from localStorage
const MIGRATE_KEYS = [
  'navigation/last-visited-folder',
  'news-ui/color-scheme',
  'popover-bookmark-editor/folder'
];

function isMigratableKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return MIGRATE_KEYS.includes(key) || MIGRATE_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Check if migration is needed
 */
export async function needsMigration() {
  const result = await chrome.storage.local.get(MIGRATION_KEY);
  return !result[MIGRATION_KEY];
}

/**
 * Perform migration from localStorage
 * This needs to be called from a page context where localStorage is available
 */
export async function migrateFromPage(localStorageData) {
  if (!(await needsMigration())) {
    return {
      success: true,
      skipped: true,
      reason: 'already-migrated',
      migratedKeys: [],
      timestamp: Date.now()
    };
  }

  if (!localStorageData || typeof localStorageData !== 'object') {
    throw new Error('localStorageData must be an object');
  }

  const migrated = {};

  for (const [key, value] of Object.entries(localStorageData)) {
    if (isMigratableKey(key) && value !== undefined) {
      migrated[key] = value;
    }
  }

  try {
    // Save migrated data
    if (Object.keys(migrated).length > 0) {
      await chrome.storage.local.set(migrated);
    }

    // Mark migration as complete only if all writes succeeded
    await chrome.storage.local.set({ [MIGRATION_KEY]: Date.now() });
  } catch (error) {
    throw new Error(`Migration failed: ${error.message}`);
  }

  return {
    success: true,
    migratedKeys: Object.keys(migrated),
    timestamp: Date.now()
  };
}

/**
 * Get migration status
 */
export async function getMigrationStatus() {
  const result = await chrome.storage.local.get(MIGRATION_KEY);

  if (result[MIGRATION_KEY]) {
    return {
      completed: true,
      timestamp: result[MIGRATION_KEY]
    };
  }

  return {
    completed: false,
    keysToMigrate: [...MIGRATE_KEYS, 'style/*']
  };
}

/**
 * Reset migration status (for testing)
 */
export async function resetMigration() {
  await chrome.storage.local.remove(MIGRATION_KEY);
  return { success: true };
}

/**
 * Initialize migration module
 */
export function initMigration() {
  registerHandlers({
    needsMigration: async () => needsMigration(),
    migrateFromPage: async ({ localStorageData }) => migrateFromPage(localStorageData),
    getMigrationStatus: async () => getMigrationStatus(),
    resetMigration: async () => resetMigration()
  });

  console.log('[Migration] Module initialized');
}

export default {
  needsMigration,
  migrateFromPage,
  getMigrationStatus,
  resetMigration,
  initMigration
};
