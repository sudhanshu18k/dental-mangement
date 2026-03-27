import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="login-page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        {/* Branding header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            width: '64px', height: '64px', borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '2.25rem',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 28px rgba(14, 165, 233, 0.4)',
          }}>
            S
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
            SmileSync
          </h1>
          <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            Owner Edition
          </p>
        </div>

        {/* Clerk SignIn component */}
        <SignIn
          appearance={{
            elements: {
              rootBox: {
                boxShadow: 'none',
              },
              card: {
                background: 'rgba(255, 255, 255, 0.55)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '1.5rem',
                boxShadow: '0 8px 32px rgba(31, 38, 135, 0.07)',
              },
              headerTitle: {
                fontFamily: 'Outfit, sans-serif',
                color: '#0f172a',
              },
              headerSubtitle: {
                fontFamily: 'Outfit, sans-serif',
                color: '#64748b',
              },
              socialButtonsBlockButton: {
                fontFamily: 'Outfit, sans-serif',
                borderRadius: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                background: 'rgba(255, 255, 255, 0.4)',
              },
              formButtonPrimary: {
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                borderRadius: '0.75rem',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
              },
              formFieldInput: {
                fontFamily: 'Outfit, sans-serif',
                borderRadius: '0.75rem',
                border: '1.5px solid rgba(203, 213, 225, 0.6)',
                background: 'rgba(255, 255, 255, 0.5)',
              },
              footerActionLink: {
                color: '#0ea5e9',
                fontFamily: 'Outfit, sans-serif',
              },
              internal: {
                fontFamily: 'Outfit, sans-serif',
              },
            },
            layout: {
              socialButtonsPlacement: 'bottom',
              socialButtonsVariant: 'blockButton',
            },
          }}
        />
      </div>
    </div>
  );
}
