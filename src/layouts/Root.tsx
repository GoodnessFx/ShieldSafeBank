import { Outlet } from 'react-router';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';

export default function Root() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
