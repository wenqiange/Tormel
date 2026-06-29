import "@testing-library/jest-dom";
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Corre un cleanup después de cada test para aislar el DOM
afterEach(() => {
  cleanup();
});
