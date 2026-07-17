import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ArrowRight, Star, ChevronLeft, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, type Course } from '../lib/supabase';
import { formatPrice, cn } from '../lib/utils';

export default function Landing() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [currentSurveyIndex, setCurrentSurveyIndex] = useState(0);

  const [stats, setStats] = useState({ alumnos: 0, cursos: 0, certificados: 0 });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Fetch Courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .limit(6);
      
      if (!coursesError && coursesData) {
        setCourses(coursesData);
      }

      // Fetch Surveys with Profile data
      const { data: surveysData } = await supabase
        .from('course_surveys')
        .select('*, profiles(full_name, avatar_url), courses(title)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (surveysData) {
        setSurveys(surveysData);
      }

      // Fetch Stats
      const [
        { count: profilesCount },
        { count: coursesCount },
        { count: completedEnrollmentsCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'completed')
      ]);

      setStats({
        alumnos: profilesCount || 0,
        cursos: coursesCount || 0,
        certificados: completedEnrollmentsCount || 0
      });

      setLoading(false);
    }
    fetchData();
  }, []);

  const nextSurvey = () => {
    setCurrentSurveyIndex((prev) => (prev + 1) % surveys.length);
  };

  const prevSurvey = () => {
    setCurrentSurveyIndex((prev) => (prev - 1 + surveys.length) % surveys.length);
  };

  return (
    <div className="bg-bg text-ink">
      {/* Hero Section */}
      <section className="pt-48 pb-32 border-b-2 border-ink">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="label-brutalist mb-6">
              [ACADEMIA_TECNICA_V3.0]
            </div>
            <h1 className="text-[clamp(4rem,15vw,12rem)] leading-[0.8] mb-12">
              MATERIA <br />
              <span className="opacity-30 tracking-tighter">// DIGITAL</span>
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
              <p className="text-xl md:text-2xl max-w-[40ch] leading-tight font-medium">
                Formación técnica especializada para arquitectura, ingeniería y construcción. Domina el estándar BIM y CAD.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth" className="btn-primary flex items-center justify-center gap-3">
                  Comenzar ahora <ArrowRight size={20} />
                </Link>
                <a href="#cursos" className="btn-outline flex items-center justify-center">
                  Explorar catálogo
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-b-2 border-ink">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: 'Alumnos', value: `${stats.alumnos}` },
              { label: 'Cursos', value: `${stats.cursos}` },
              { label: 'Certificados', value: `${stats.certificados}` },
              { label: 'Soporte', value: '24/7' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="label-brutalist opacity-50">{stat.label}</div>
                <div className="font-display text-4xl font-bold italic underline decoration-2 underline-offset-4">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section id="cursos" className="py-32">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
            <div className="max-w-2xl">
              <div className="label-brutalist mb-4">CATALOG_2026</div>
              <h2 className="text-6xl md:text-8xl leading-[0.85]">Sistemas <br />de Aprendizaje</h2>
            </div>
            <Link to="/auth" className="label-brutalist underline decoration-2 underline-offset-8 decoration-accent transition-colors hover:text-accent">
              VER_TODOS_LOS_CURSOS
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-2 border-ink bg-ink">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-bg aspect-square animate-pulse" />
              ))
            ) : courses.length > 0 ? (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-bg p-8 flex flex-col border-[0.5px] border-ink/10 hover:bg-white transition-colors group"
                >
                  <div className="aspect-[4/3] mb-8 border-2 border-ink overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700">
                    <img
                      src={course.thumbnail_url || 'https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&q=80&w=1200'}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                  </div>
                  <div className="label-brutalist opacity-40 mb-2">ID: {course.id.slice(0, 8)}</div>
                  <h3 className="text-3xl mb-4 leading-none">{course.title}</h3>
                  <p className="text-sm opacity-70 mb-8 line-clamp-2">{course.description}</p>
                  <div className="mt-auto pt-8 border-t border-ink/10 flex items-center justify-between">
                    <span className="text-2xl font-bold">{formatPrice(course.price)}</span>
                    <Link
                      to={`/auth`}
                      className="label-brutalist underline decoration-accent hover:text-accent"
                    >
                      [INGRESAR]
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-bg py-32 text-center label-brutalist opacity-40">
                NO_COURSES_PUBLISHED_AT_MOMENT
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Carousel */}
      {surveys.length > 0 && (
        <section className="py-32 border-t-2 border-ink bg-ink text-bg overflow-hidden">
          <div className="container-custom">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
              <div className="max-w-2xl">
                <div className="label-brutalist mb-4 text-accent">RESEÑAS_SISTEMA</div>
                <h2 className="text-6xl md:text-8xl leading-[0.85] text-white">Lo que dicen <br />nuestros alumnos</h2>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={prevSurvey}
                  className="w-16 h-16 border-2 border-bg/30 rounded-full flex items-center justify-center text-bg hover:bg-bg hover:text-ink transition-all active:scale-95"
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  onClick={nextSurvey}
                  className="w-16 h-16 border-2 border-bg/30 rounded-full flex items-center justify-center text-bg hover:bg-bg hover:text-ink transition-all active:scale-95"
                >
                  <ChevronRight size={32} />
                </button>
              </div>
            </div>

            <div className="relative h-[400px] md:h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSurveyIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 items-center"
                >
                  <div className="space-y-6">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={24} 
                          className={cn(
                            "transition-colors",
                            i < surveys[currentSurveyIndex].rating ? "text-accent fill-accent" : "text-bg/10"
                          )} 
                        />
                      ))}
                    </div>
                    <div>
                      <h4 className="text-3xl font-bold leading-tight">{surveys[currentSurveyIndex].profiles?.full_name}</h4>
                      <p className="label-brutalist opacity-50 mt-2">Curso: {surveys[currentSurveyIndex].courses?.title}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <Quote size={80} className="absolute -top-12 -left-12 opacity-10 text-accent" />
                    <p className="text-2xl md:text-4xl leading-tight font-medium italic relative z-10">
                      "{surveys[currentSurveyIndex].comment || 'Sin comentarios adicionales.'}"
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="mt-24 flex justify-center gap-2">
              {surveys.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSurveyIndex(i)}
                  className={cn(
                    "w-12 h-1 bg-bg/20 transition-all",
                    i === currentSurveyIndex && "bg-accent w-24"
                  )}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-32 border-t-2 border-ink bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-24">
            <div>
              <div className="label-brutalist mb-4">FAQ_SYSTEM</div>
              <h2 className="text-6xl leading-[0.85]">Consultas <br />Frecuentes</h2>
              <p className="mt-8 text-lg opacity-70 leading-relaxed">
                Información detallada sobre el funcionamiento de nuestra plataforma y procesos de certificación.
              </p>
            </div>
            <div className="divide-y-2 divide-ink">
              {[
                { q: '¿Necesito conocimientos previos?', a: 'Depende del curso, pero la mayoría comienzan desde lo básico hasta nivel avanzado.' },
                { q: '¿Cómo obtengo el certificado?', a: 'Al completar todas las lecciones y aprobar la entrega final, podrás descargar tu certificado automáticamente.' },
                { q: '¿Por cuánto tiempo tengo acceso?', a: 'Una vez inscrito, el acceso es de por vida, incluyendo actualizaciones futuras.' }
              ].map((faq, i) => (
                <details key={i} className="group py-8 cursor-pointer first:pt-0">
                  <summary className="flex items-center justify-between text-2xl font-bold uppercase tracking-tight list-none">
                    {faq.q}
                    <ChevronRight size={24} className="group-open:rotate-90 transition-transform opacity-30 group-hover:opacity-100" />
                  </summary>
                  <p className="mt-8 text-lg opacity-70 leading-relaxed max-w-2xl font-mono">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
