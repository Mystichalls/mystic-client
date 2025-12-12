// pages/supabase-callback.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Bezig met inloggen...");

  useEffect(() => {
    const supabase = createPagesBrowserClient();

    (async () => {
      try {
        // Dit is de belangrijke stap: code -> session + cookies
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error("exchangeCodeForSession error:", error);
          setMessage("Inloggen mislukt. Vraag een nieuwe inloglink aan.");
          return;
        }

        router.replace("/dashboard");
      } catch (e) {
        console.error(e);
        setMessage("Onbekende fout bij het inloggen.");
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
