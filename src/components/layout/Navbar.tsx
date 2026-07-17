import { Link, useNavigate } from 'react-router-dom';
import { supabase, type Profile } from '../../lib/supabase';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar({ profile, settings }: { profile: Profile | null; settings: any }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg border-b-2 border-ink h-[120px]">
      <div className="container-custom h-full flex items-center justify-between">
        <Link to="/" className="logo font-display text-4xl font-bold tracking-tighter text-ink">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-16 object-contain" />
          ) : (
            'MATERIA // DIGI'
          )}
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-12 font-mono text-xs font-bold tracking-widest">
          <Link to="/" className="text-ink hover:underline">INICIO</Link>
          <a href="#cursos" className="text-ink hover:underline">CURSOS</a>
          {profile ? (
            <div className="flex items-center gap-12">
              <Link 
                to={profile.role === 'admin' ? '/admin' : '/dashboard'} 
                className="text-ink hover:underline"
              >
                MI_PANEL
              </Link>
              <button 
                onClick={handleSignOut}
                className="text-accent hover:underline"
              >
                LOG_OUT
              </button>
            </div>
          ) : (
            <Link 
              to="/auth" 
              className="text-ink underline decoration-2 underline-offset-8"
            >
              SIGN_IN
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-ink"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={32} /> : <Menu size={32} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[120px] left-0 right-0 bg-bg border-b-2 border-ink p-12 z-50">
          <div className="flex flex-col gap-8 font-mono text-sm font-bold tracking-widest uppercase">
            <Link to="/" onClick={() => setIsMenuOpen(false)}>INICIO</Link>
            <a href="#cursos" onClick={() => setIsMenuOpen(false)}>CURSOS</a>
            {profile ? (
              <>
                <Link to={profile.role === 'admin' ? '/admin' : '/dashboard'} onClick={() => setIsMenuOpen(false)}>MI_PANEL</Link>
                <button onClick={handleSignOut} className="text-left text-accent underline">LOG_OUT</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="underline decoration-2 underline-offset-8">SIGN_IN</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
