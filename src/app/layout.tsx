import type { Metadata } from 'next';
import { ClerkProvider, SignInButton, SignUpButton, Show } from '@clerk/nextjs';
import './globals.css';
import { StoreProvider } from '@/store';

export const metadata: Metadata = {
  title: 'SmileSync – Owner Edition',
  description: 'A premium dental clinic management system for clinic owners. Manage patients, appointments, treatments, and billing effortlessly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="animate-fade-in">
        <ClerkProvider>
          <div className="auth-overlay-header">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="btn btn-primary btn-sm">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-secondary btn-sm">Register</button>
              </SignUpButton>
            </Show>
          </div>
          <StoreProvider>
            {children}
          </StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
