// Mock for wxt/utils/storage
// Use a module-level Map that can be cleared between tests

// Global state that can be reset
const state = {
  storage: new Map<string, unknown>(),
};

export const storage = {
  defineItem: <T>(key: string, options?: { fallback: T }) => ({
    getValue: async () => {
      const value = state.storage.get(key);
      if (value === undefined) {
        return options?.fallback;
      }
      return value as T;
    },
    setValue: async (value: T) => {
      state.storage.set(key, value);
    },
    watch: () => {},
    removeValue: async () => {
      state.storage.delete(key);
    },
  }),
};

// Helper functions for tests
export function clearMockStorage() {
  state.storage = new Map<string, unknown>();
}

export function setMockStorageValue(key: string, value: unknown) {
  state.storage.set(key, value);
}

export function getMockStorageValue(key: string) {
  return state.storage.get(key);
}

// Reset function that clears the internal map reference
export function resetMockStorage() {
  state.storage.clear();
}
