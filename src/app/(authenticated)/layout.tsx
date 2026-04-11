import Sidebar from '@/components/Sidebar';
import ThemeProvider from '@/components/ThemeProvider';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Clerk middleware already protects these routes — no manual auth check needed
  return (
    <ThemeProvider>
      <div className="app-layout">
        <Sidebar />
        <div className="main-area">
          <div className="main-content-panel">
            {children}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
