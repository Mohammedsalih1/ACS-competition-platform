import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-64"><Navbar onMenuClick={() => setSidebarOpen(true)} /><main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(244,154,38,.08),transparent_28rem)]"><Outlet /></main></div>
    </div>
  );
}
