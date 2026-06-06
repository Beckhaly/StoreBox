import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup }   from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear(); // Reset du Zustand persist entre les tests
});
