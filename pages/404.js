// pages/404.js
import Link from "next/link";

export default function Custom404() {
  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>404 – Pagina niet gevonden</h1>
        <p style={styles.text}>
          Deze pagina bestaat niet (meer). Ga terug naar je dashboard of log in.
        </p>
        <div style={styles.row}>
          <Link href="/dashboard" style={styles.btnPrimary}>Naar dashboard</Link>
          <Link href="/login" style={styles.btnSecondary}>Inloggen</Link>
        </div>
      </div>
    </main>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1220", padding: "24px" },
  card: { width: "100%", maxWidth: 560, background: "#0f172a", border: "1px solid #23324d", borderRadius: 16, padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.25)" },
  title: { margin: 0, marginBottom: 12, fontSize: 28, color: "#e2e8f0" },
  text: { margin: 0, marginBottom: 20, color: "#94a3b8", lineHeight: 1.6 },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  btnPrimary: { padding: "10px 14px", background: "#2563eb", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 600 },
  btnSecondary: { padding: "10px 14px", background: "#334155", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 600 },
};
