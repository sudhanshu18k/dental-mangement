import type { Metadata } from 'next';
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';
import './globals.css';
import { StoreProvider } from '@/store';

export const metadata: Metadata = {
  title: 'SmileSync – Owner Edition',
  description: 'A premium dental clinic management system for clinic owners. Manage patients, appointments, treatments, and billing effortlessly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header style={{ padding: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.1)' }}>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <StoreProvider>
            {children}
          </StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
