import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Instagram, Facebook, Linkedin, Youtube, MessageCircle } from 'lucide-react';

export default function Footer() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('site_settings').select('*').eq('id', 1).single();
      if (data) setSettings(data);
    }
    fetchSettings();
  }, []);

  return (
    <footer className="bg-white border-t border-slate-100 py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-8 grayscale opacity-50" />
              ) : (
                <span className="font-black text-xl tracking-tighter text-slate-300 italic">MATERIA DIGITAL</span>
              )}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              SISTEMA DE APRENDIZAJE ESPECIALIZADO // 2026
            </p>
          </div>

          <div className="flex items-center gap-6">
            {settings?.whatsapp_support && (
              <a href={`https://wa.me/${settings.whatsapp_support.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-500 transition-colors">
                <MessageCircle size={20} />
              </a>
            )}
            {settings?.instagram_url && (
              <a href={settings.instagram_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                <Instagram size={20} />
              </a>
            )}
            {settings?.facebook_url && (
              <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                <Facebook size={20} />
              </a>
            )}
            {settings?.linkedin_url && (
              <a href={settings.linkedin_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                <Linkedin size={20} />
              </a>
            )}
            {settings?.youtube_url && (
              <a href={settings.youtube_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                <Youtube size={20} />
              </a>
            )}
          </div>

          <div className="text-center md:text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              © 2026 MATERIA DIGITAL
            </p>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
              ESTUDIO DE DISEÑO & TECNOLOGÍA
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
