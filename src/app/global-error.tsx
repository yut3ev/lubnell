'use client';

// U54-PERF-ROBUST — global-error catches failures in the ROOT layout itself
// (font load crash, provider throw…). It replaces the whole document, so it
// must render its own <html>/<body> and cannot rely on globals.css/Tailwind —
// inline styles only. Arabic RTL, zero error details shown to the user.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof console !== 'undefined') {
    console.error('[global-error]', error?.digest ?? error);
  }
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f4ef',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'Cairo', sans-serif",
          color: '#1c1c1c',
          padding: '24px',
        }}
      >
        <div
          role="alert"
          style={{
            width: '100%',
            maxWidth: 420,
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 24,
            padding: '40px 28px',
            boxShadow: '0 10px 30px rgba(1,15,28,0.06)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">🛍️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            حصلت مشكلة مؤقتة
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.9, margin: '0 0 24px', color: '#6b6b6b' }}>
            حصلت مشكلة غير متوقعة. جرّبي تاني — ولو استمرت، كلمينا على واتساب
            وهنظبطها فورًا.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-block',
              height: 44,
              padding: '0 28px',
              borderRadius: 999,
              border: 'none',
              background: '#010F1C',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
