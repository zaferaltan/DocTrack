/// <reference types="vite/client" />

import type { DocTrackApi } from '@shared/ipc';

declare global {
  interface Window {
    docTrack: DocTrackApi;
  }

  interface File {
    path?: string;
  }
}

declare module '*.sql?raw' {
  const sql: string;
  export default sql;
}

export {};
