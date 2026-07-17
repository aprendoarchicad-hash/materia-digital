import { useEffect, useState } from 'react';
import { supabase, type Profile, type Course, type Enrollment } from '../lib/supabase';
import { motion } from 'motion/react';
import { Book, PlayCircle, Clock, ChevronRight, Award, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard({ profile }: { profile: Profile | null }) {
  const [enrollments, setEnrollments] = useState<(Enrollment & { courses: Course, certificates: any[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEnrollments() {
      if (!profile) return;
      try {
        console.log('Fetching enrollments for student:', profile.id);
        const { data, error } = await supabase
          .from('enrollments')
          .select(`
            *,
            courses (*),
            certificates (*)
          `)
          .eq('student_id', profile.id);
        
        if (error) throw error;
        console.log('Enrollments data received:', data);
        
        // Debug: Fetch certificates directly to check RLS
        const { data: directCerts, error: certError } = await supabase.from('certificates').select('*');
        console.log('Direct certificates fetch (debug):', { data: directCerts, error: certError });

        if (data) {
          setEnrollments(data as any);
          data.forEach(e => {
            console.log(`Enrollment for ${e.courses?.title || 'unknown'}:`, {
              id: e.id,
              certificates: e.certificates,
              isCertArray: Array.isArray(e.certificates)
            });
          });
        }
      } catch (err) {
        console.error('Error fetching enrollments/certificates:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEnrollments();
  }, [profile]);

  const certificates = enrollments
    .filter(e => {
      const certs = e.certificates;
      if (!certs) return false;
      if (Array.isArray(certs)) return certs.length > 0;
      return true; // It's an object
    })
    .map(e => {
      const cert = Array.isArray(e.certificates) ? e.certificates[0] : e.certificates;
      const course = Array.isArray(e.courses) ? e.courses[0] : e.courses;
      return {
        ...cert,
        course_title: course?.title || 'Curso'
      };
    });

  return (
    <div className="container mx-auto px-6 py-12 pt-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Hola, {profile?.full_name?.split(' ')[0] || 'Estudiante'} 👋
          </h1>
          <p className="text-slate-500 font-medium">Bienvenido a tu aula virtual. Continúa con tu formación técnica.</p>
        </div>
        <Link 
          to="/resources"
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-slate-600 hover:text-slate-900 hover:shadow-lg transition-all"
        >
          <FileText size={20} /> Ver Recursos y Materiales
        </Link>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : enrollments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {enrollments.map((enrollment) => (
            <motion.div
              key={enrollment.id}
              whileHover={{ y: -5 }}
              className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col"
            >
              <div className="aspect-video relative group">
                <img
                  src={enrollment.courses.thumbnail_url || 'https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&q=80&w=1200'}
                  alt={enrollment.courses.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle className="text-white" size={48} />
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{enrollment.courses.title}</h3>
                
                <div className="mt-4 mb-6">
                  <div className="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                    <span>Progreso</span>
                    <span>{Math.round(enrollment.progress_percent)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${enrollment.progress_percent}%` }}
                      className="h-full bg-slate-900" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={16} />
                    <span className="text-xs font-medium">Continúa donde dejaste</span>
                  </div>
                  <Link
                    to={`/dashboard/course/${enrollment.courses.id}`}
                    className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
          
          <Link
            to="/#cursos"
            className="border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all group"
          >
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Book size={24} />
            </div>
            <span className="font-bold">Inscribirse en más cursos</span>
          </Link>
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Book className="text-slate-300" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Aún no tienes cursos</h2>
          <p className="text-slate-500 mb-8">Explora nuestra oferta académica y comienza hoy.</p>
          <Link
            to="/#cursos"
            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold inline-flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            Ver catálogo <ChevronRight size={20} />
          </Link>
        </div>
      )}

      {/* Certificaciones Section */}
      {enrollments.length > 0 && (
        <section className="mt-20">
          <div className="flex items-center gap-2 mb-8">
            <Award className="text-slate-900" size={24} />
            <h2 className="text-xl font-bold text-slate-900">Tus Certificaciones</h2>
          </div>
          
          {certificates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <div key={cert.id} className="bg-white p-8 border border-slate-100 rounded-3xl shadow-sm flex flex-col items-center text-center group">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Award size={32} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{cert.course_title}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Certificado de Finalización</p>
                  <a 
                    href={cert.certificate_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-50 text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <Download size={14} /> Descargar PDF
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 border border-slate-100 bg-white rounded-3xl text-center">
              <p className="text-slate-400 text-sm italic">Completa tus cursos para obtener tus certificados profesionales.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
