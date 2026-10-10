"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f7f7f8", color: "#151c23", textAlign: "center", padding: 16 }}>
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 56, margin: 0 }}>😕</p>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Bir şeyler ters gitti</h1>
          <p style={{ color: "#6b6b6b" }}>Sayfa yüklenemedi. Lütfen tekrar dene.</p>
          <button onClick={reset} style={{ marginTop: 12, background: "#f26a12", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 16 }}>
            Tekrar dene
          </button>
          {error.digest && <p style={{ marginTop: 24, fontSize: 12, color: "#6b6b6b" }}>Hata kodu: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
