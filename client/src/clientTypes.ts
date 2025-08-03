// Client-specific types

import { Query } from '../../src/types';

// Loading state types (client-only)
export type LoadingState = 
  | { type: "idle" }
  | { type: "loading" }
  | { type: "loaded"; data: any[]; total: number }
  | { type: "error"; error: string };

// Query state (combines Query and LoadingState - client-only)
export interface QueryState {
  query: Query;
  state: LoadingState;
}