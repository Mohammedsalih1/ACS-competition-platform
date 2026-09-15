import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout() {
  return (
    <div>
      <Sidebar />
      <Navbar />
      <div className="pl-64 pt-16 min-h-screen bg-background">
        <Outlet />
      </div>
    </div>
  );
}
