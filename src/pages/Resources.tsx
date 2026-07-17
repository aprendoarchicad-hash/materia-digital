import React, { useEffect, useState } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import { motion } from 'motion/react';
import { FileText, Download, Search, Filter } from 'lucide-react';

export default function Resources({ profile }: { profile: Profile | null }) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    async function fetchResources() {
      if (!profile) return;
      
      const { data, error } = await supabase
        .from('resources')
        .select('*, courses(title)');
      
      if (!error && data) {
        setResources(data);
      }
      setLoading(false);
    }
    fetchResources();
  }, [profile]);

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         res.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || res.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(resources.map(res => res.category))];

  return (
    <div className="container mx-auto px-6 py-12 pt-32 min-h-screen">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Recursos y Materiales</h1>
        <p className="text-slate-500 font-medium">Descarga manuales, plantillas y herramientas para potenciar tu formación.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 mb-10">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar recursos..."
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:border-slate-900 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-4 py-2 shadow-sm">
          <Filter size={18} className="text-slate-400" />
          <select 
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none capitalize"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'Todas las categorías' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredResources.map((res) => (
            <motion.div
              key={res.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl transition-all flex flex-col group"
            >
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                <FileText size={28} />
              </div>
              
              <div className="flex-grow">
                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {res.category}
                  </span>
                  {res.courses && (
                    <span className="px-2 py-0.5 bg-blue-50 rounded text-[10px] font-bold uppercase tracking-widest text-blue-500 line-clamp-1">
                      {res.courses.title}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{res.title}</h3>
                <p className="text-sm text-slate-500 font-medium mb-8 line-clamp-3">{res.description}</p>
              </div>

              <a 
                href={res.file_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]"
              >
                <Download size={18} /> Descargar Recursos
              </a>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl">
          <FileText className="mx-auto text-slate-100 mb-4" size={64} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No se encontraron recursos</h2>
          <p className="text-slate-500">Intenta con otros términos o filtros.</p>
        </div>
      )}
    </div>
  );
}
