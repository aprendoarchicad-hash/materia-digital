import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, type Profile } from './lib/supabase';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Classroom from './pages/Classroom';
import Resources from './pages/Resources';
import Auth from './pages/Auth';
import ConfirmEmail from './pages/ConfirmEmail';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/WhatsAppButton';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else setLoading(false);
    });

    async function fetchSettings() {
      try {
        const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, user: any) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setProfile(data);
      } else {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: userId, 
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Nuevo Alumno',
              role: 'student' 
            }
          ])
          .select()
          .single();
        
        if (createError) {
          if (createError.code === '23505') {
            const { data: retryData } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (retryData) setProfile(retryData);
            return;
          }
          throw createError;
        }
        setProfile(newProfile);
      }
    } catch (error: any) {
      console.error('Error with profile:', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="font-mono text-xs uppercase tracking-widest animate-pulse">[SYSTEM_INITIALIZING...]</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-bg text-ink">
      <Navbar profile={profile} settings={settings} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={session ? <Navigate to="/dashboard" /> : <Auth />} />
          
          {/* Student Protected Routes */}
          <Route 
            path="/dashboard/*" 
            element={
              session ? (
                profile?.role === 'admin' ? <Navigate to="/admin" /> : <Dashboard profile={profile} />
              ) : <Navigate to="/auth" />
            } 
          />

          <Route 
            path="/dashboard/course/:id" 
            element={
              session ? (
                profile?.role === 'admin' ? <Navigate to="/admin" /> : <Classroom />
              ) : <Navigate to="/auth" />
            } 
          />

          <Route 
            path="/resources" 
            element={
              session ? (
                profile?.role === 'admin' ? <Navigate to="/admin" /> : <Resources profile={profile} />
              ) : <Navigate to="/auth" />
            } 
          />

          {/* Admin Protected Routes */}
          <Route 
            path="/admin/*" 
            element={
              session && profile?.role === 'admin' ? (
                <AdminDashboard profile={profile} />
              ) : <Navigate to="/" />
            } 
          />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

