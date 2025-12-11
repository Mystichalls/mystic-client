// pages/_app.js
import { useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

// ⚠️ If you had a global CSS import before, keep it:
// import '../styles/globals.css'

export default function MyApp({ Component, pageProps }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

   return (
     <SessionContextProvider
       supabaseClient={supabaseClient}
       initialSession={pageProps.initialSession}
     >
       <Component {...pageProps} />
     </SessionContextProvider>
   );
}
