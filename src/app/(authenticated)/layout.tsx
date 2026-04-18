import ThemeProvider from '@/components/ThemeProvider';
import AppLayoutClient from '@/components/AppLayoutClient';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Clerk middleware already protects these routes
  return (
    <ThemeProvider>
      <AppLayoutClient>
        {children}
      </AppLayoutClient>
    </ThemeProvider>
  );
}
