import { Outlet } from 'react-router';

export default function AdminRoot() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2338', fontFamily: 'IBM Plex Mono, monospace' }}>
      <Outlet />
    </div>
  );
}
