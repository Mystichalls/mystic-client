// pages/_app.js
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '../lib/supabase';

export default function MyApp({ Component, pageProps }) {
  return (
    <SessionContextProvider
      supabaseClient={supabase}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
