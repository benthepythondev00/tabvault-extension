// Test setup file
import { beforeEach } from 'vitest';
import { clearMockStorage } from './mocks/wxt-storage';

// Clear storage before each test
beforeEach(() => {
  clearMockStorage();
});

// Export helpers from the mock for test usage
export {
  clearMockStorage,
  setMockStorageValue,
  getMockStorageValue,
} from './mocks/wxt-storage';
