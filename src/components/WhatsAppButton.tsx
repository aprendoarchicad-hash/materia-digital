import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function WhatsAppButton() {
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('site_settings').select('whatsapp_support').eq('id', 1).single();
      if (data?.whatsapp_support) {
        setWhatsapp(data.whatsapp_support.replace(/\s+/g, ''));
      }
    }
    fetchSettings();
  }, []);

  if (!whatsapp) return null;

  return (
    <AnimatePresence>
      <motion.a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(37,211,102,0.4)] border-2 border-white/20 group"
        title="Contactar por WhatsApp"
      >
        <MessageCircle size={32} className="fill-white/10" />
        <span className="absolute right-full mr-4 bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-100">
          ¿En qué podemos ayudarte?
        </span>
      </motion.a>
    </AnimatePresence>
  );
}
