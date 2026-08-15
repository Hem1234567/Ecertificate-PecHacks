import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav bar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px', borderBottom: '1px solid var(--border-soft)',
        background: 'var(--bg-elev)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold) 60%, var(--gold-dim) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, color: '#201703', fontSize: 15,
            boxShadow: '0 0 0 3px rgba(201,162,75,0.15)',
          }}>CG</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>Certify</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Certificate Studio</div>
          </div>
        </div>
        <Link to="/admin" style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: 'linear-gradient(180deg, var(--gold-soft), var(--gold))',
          color: '#211804', border: '1px solid var(--gold)', textDecoration: 'none',
          transition: 'filter .15s',
        }}>Admin Login →</Link>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '80px 24px',
        background: `
          radial-gradient(900px 500px at 50% 0%, rgba(201,162,75,0.08), transparent 60%),
          radial-gradient(600px 400px at 80% 80%, rgba(111,184,172,0.06), transparent 55%)
        `,
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
          padding: '6px 16px', borderRadius: 999,
          background: 'rgba(201,162,75,0.12)', border: '1px solid var(--gold-dim)',
          color: 'var(--gold-soft)', fontSize: 12.5, fontWeight: 600, letterSpacing: '.04em',
        }}>
          ✦ Pechacks 4.0 — High School Track
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 700, margin: '0 0 20px',
          background: 'linear-gradient(135deg, var(--gold-soft) 0%, var(--gold) 50%, var(--text) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          lineHeight: 1.1,
        }}>
          Your Achievement,<br />Officially Certified
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 2vw, 19px)', color: 'var(--text-dim)', maxWidth: 580,
          lineHeight: 1.7, margin: '0 0 16px',
        }}>
          Congratulations to all participants of <strong style={{ color: 'var(--text)' }}>Pechacks 4.0</strong> — the inter-school hackathon that brought together the brightest young minds.
        </p>
        <p style={{
          fontSize: 15, color: 'var(--text-faint)', maxWidth: 520, lineHeight: 1.7, margin: '0 0 48px',
        }}>
          If you received an email with your certificate link, click the <em>Download Certificate</em> button in that email to view and save your personalized certificate.
        </p>

        {/* Steps */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20, maxWidth: 800, width: '100%', marginBottom: 64,
        }}>
          {[
            { icon: '📧', title: 'Check Your Email', desc: 'Look for the certificate email sent to your registered address.' },
            { icon: '🔗', title: 'Click the Link', desc: 'Click the "Download Certificate" button inside the email.' },
            { icon: '📄', title: 'Download Your PDF', desc: 'View and save your official participation certificate.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: 'var(--surface)', border: '1px solid var(--border-soft)',
              borderRadius: 14, padding: '24px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center',
          padding: '28px 40px', borderRadius: 16,
          background: 'var(--surface)', border: '1px solid var(--border-soft)',
          marginBottom: 48, maxWidth: 700, width: '100%',
        }}>
          {[
            { num: '500+', label: 'Participants' },
            { num: '100+', label: 'Teams' },
            { num: '24hrs', label: 'Hackathon Duration' },
            { num: '3–5', label: 'Members per Team' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--gold-soft)', fontWeight: 700 }}>{num}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          Didn't receive your certificate?{' '}
          <a href="mailto:support@pechacks.com" style={{ color: 'var(--teal)' }}>Contact the organizers</a>
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '20px 48px', borderTop: '1px solid var(--border-soft)',
        color: 'var(--text-faint)', fontSize: 12, textAlign: 'center',
      }}>
        © {new Date().getFullYear()} Pechacks 4.0 · Powered by Certify
      </footer>
    </div>
  )
}
