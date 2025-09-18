// lib/telemetry.js
import { supabase } from './supabase';

// Voeg een vaste versie-tag toe aan elk event
const APP_VERSION = 'mh-client@0.1.0';

export async function track(event, props = {}) {
  try {
    // Haal session op voor Bearer token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[track] geen session -> skip', event);
      return false;
    }

    // Verstuur naar je API
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        event,
        // props + standaard metadata
        props: {
          ...props,
          appVersion: APP_VERSION,
        },
      }),
    });

    if (!res.ok) {
      console.warn('[track] server error', event, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[track] failed', e);
    return false;
  }
}
