'use client';

import { createClient } from '@/lib/supabase/client';
import { demoRpc, isDemoOn, type DemoRpcResult } from './demo';

/**
 * Call a database function: the real one, or the local copy while demo mode is on.
 * Same result shape either way, so screens do not care which one answered.
 */
export async function appRpc(fn: string, args: Record<string, unknown>): Promise<DemoRpcResult> {
  if (isDemoOn()) return demoRpc(fn, args);
  const { data, error } = await createClient().rpc(fn, args);
  return { data, error: error ? { message: error.message } : null };
}
