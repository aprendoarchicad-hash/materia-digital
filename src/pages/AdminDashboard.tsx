import React, { useEffect, useState } from 'react';
import { supabase, type Profile, type Course } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, BookOpen, Users, Settings, Award, Plus, ExternalLink, BarChart3, X, Save, Trash2, FileText, Download, Link2 } from 'lucide-react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { formatPrice } from '../lib/utils';

export default function AdminDashboard({ profile }: { profile: Profile | null }) {
  const location = useLocation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ alumnos: 0, cursos: 0, ingresos: 0, certificados: 0 });
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [isAddingLesson, setIsAddingLesson] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({ title: '', youtube_url: '' });
  const [editingLessonQuiz, setEditingLessonQuiz] = useState<{lesson_id: string, lesson_title: string, questions: any[]} | null>(null);
  const [editingGlobalExam, setEditingGlobalExam] = useState<{course_id: string, course_title: string, questions: any[], passing_score: number} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [
      { data: coursesData },
      { count: profilesCount },
      { count: completedCount },
      { data: incomeData }
    ] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('enrollments').select('courses(price)')
    ]);

    if (coursesData) setCourses(coursesData);
    
    // Calcular ingresos reales sumando el precio de los cursos inscritos
    const totalIncome = (incomeData as any[])?.reduce((acc, curr) => acc + (curr.courses?.price || 0), 0) || 0;
    
    setStats({
      alumnos: profilesCount || 0,
      cursos: coursesData?.length || 0,
      ingresos: totalIncome,
      certificados: completedCount || 0
    });
    setLoading(false);
  }

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    const courseData = {
      title: editingCourse.title,
      description: editingCourse.description,
      price: editingCourse.price,
      thumbnail_url: editingCourse.thumbnail_url,
      is_published: editingCourse.is_published ?? false,
    };

    if (editingCourse.id) {
      await supabase.from('courses').update(courseData).eq('id', editingCourse.id);
    } else {
      await supabase.from('courses').insert([courseData]);
    }

    setShowCourseModal(false);
    setEditingCourse(null);
    fetchData();
  };

  const handleDeleteCourse = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este curso?')) {
      await supabase.from('courses').delete().eq('id', id);
      fetchData();
    }
  };

  const fetchModules = async (courseId: string) => {
    const { data } = await supabase
      .from('modules')
      .select('*, lessons(*)')
      .eq('course_id', courseId)
      .order('order', { ascending: true });
    
    if (data) {
      const sortedModules = data.map(m => ({
        ...m,
        lessons: m.lessons?.sort((a: any, b: any) => a.order - b.order) || []
      }));
      setModules(sortedModules);
    }
  };

  const handleManageContent = async (course: Course) => {
    setManagingCourse(course);
    await fetchModules(course.id);
  };

  const handleManageQuiz = async (lesson: any) => {
    const { data } = await supabase
      .from('lesson_quizzes')
      .select('*')
      .eq('lesson_id', lesson.id)
      .maybeSingle();
    
    setEditingLessonQuiz({
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      questions: (data?.questions && data.questions.length > 0) ? data.questions : Array.from({ length: 5 }, () => ({ question: '', options: ['', '', '', ''], correct: 0 }))
    });
  };

  const handleManageGlobalExam = async (course: Course) => {
    const { data } = await supabase
      .from('course_exams')
      .select('*')
      .eq('course_id', course.id)
      .maybeSingle();
    
    setEditingGlobalExam({
      course_id: course.id,
      course_title: course.title,
      questions: (data?.questions && data.questions.length > 0) ? data.questions : Array.from({ length: 10 }, () => ({ question: '', options: ['', '', '', ''], correct: 0 })),
      passing_score: data?.passing_score || 70
    });
  };

  const handleSaveGlobalExam = async () => {
    if (!editingGlobalExam) return;
    
    try {
      const validQuestions = editingGlobalExam.questions.filter(q => q.question && q.question.trim() !== '');
      
      if (validQuestions.length === 0) {
        alert('Por favor, ingresa al menos una pregunta.');
        return;
      }

      const { error } = await supabase
        .from('course_exams')
        .upsert({
          course_id: editingGlobalExam.course_id,
          questions: validQuestions,
          passing_score: editingGlobalExam.passing_score,
          is_published: true
        }, { onConflict: 'course_id' });

      if (error) throw error;

      setEditingGlobalExam(null);
      alert('¡Examen Global guardado con éxito!');
    } catch (err: any) {
      console.error('Error al guardar examen global:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveQuiz = async () => {
    if (!editingLessonQuiz) return;
    
    try {
      // Filtrar preguntas vacías
      const validQuestions = editingLessonQuiz.questions.filter(q => q.question && q.question.trim() !== '');
      
      if (validQuestions.length === 0) {
        alert('Por favor, ingresa al menos una pregunta.');
        return;
      }

      console.log('Guardando examen para lección:', editingLessonQuiz.lesson_id);
      
      const { error } = await supabase
        .from('lesson_quizzes')
        .upsert({
          lesson_id: editingLessonQuiz.lesson_id,
          questions: validQuestions
        }, { onConflict: 'lesson_id' });

      if (error) {
        throw error;
      }

      setEditingLessonQuiz(null);
      alert('¡Examen guardado con éxito!');
    } catch (err: any) {
      console.error('Error completo al guardar:', err);
      alert(`Error al guardar: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleAddModule = async () => {
    if (!managingCourse || !newModuleTitle) return;
    const { error } = await supabase.from('modules').insert([
      { course_id: managingCourse.id, title: newModuleTitle, order: modules.length + 1 }
    ]);
    if (!error) {
      setNewModuleTitle('');
      setIsAddingModule(false);
      fetchModules(managingCourse.id);
    }
  };

  const handleAddLesson = async (moduleId: string) => {
    if (!managingCourse || !newLesson.title || !newLesson.youtube_url) return;
    
    let videoId = newLesson.youtube_url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = newLesson.youtube_url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }

    const module = modules.find(m => m.id === moduleId);
    const { error } = await supabase.from('lessons').insert([
      { 
        module_id: moduleId, 
        title: newLesson.title, 
        youtube_id: videoId, 
        order: (module?.lessons?.length || 0) + 1 
      }
    ]);

    if (!error) {
      setNewLesson({ title: '', youtube_url: '' });
      setIsAddingLesson(null);
      fetchModules(managingCourse.id);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm('¿Eliminar este módulo y todas sus lecciones?')) {
      await supabase.from('modules').delete().eq('id', moduleId);
      if (managingCourse) fetchModules(managingCourse.id);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (confirm('¿Eliminar esta lección?')) {
      await supabase.from('lessons').delete().eq('id', lessonId);
      if (managingCourse) fetchModules(managingCourse.id);
    }
  };

  const statCards = [
    { label: 'Alumnos', value: stats.alumnos, icon: Users, color: 'bg-blue-500' },
    { label: 'Cursos', value: stats.cursos, icon: BookOpen, color: 'bg-emerald-500' },
    { label: 'Ingresos', value: formatPrice(stats.ingresos), icon: BarChart3, color: 'bg-amber-500' },
    { label: 'Certificados', value: stats.certificados, icon: Award, color: 'bg-violet-500' },
  ];

  return (
    <div className="container mx-auto px-6 py-12 pt-32">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-col gap-2 p-4 bg-white border border-slate-100 rounded-3xl sticky top-32">
            <Link 
              to="/admin" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${location.pathname === '/admin' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={20} /> Dashboard
            </Link>
            <Link 
              to="/admin/courses" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${location.pathname.includes('/admin/courses') ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <BookOpen size={20} /> Cursos
            </Link>
            <Link 
              to="/admin/students" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${location.pathname.includes('/admin/students') ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Users size={20} /> Alumnos
            </Link>
            <Link 
              to="/admin/resources" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${location.pathname.includes('/admin/resources') ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileText size={20} /> Recursos
            </Link>
            <Link 
              to="/admin/settings" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${location.pathname.includes('/admin/settings') ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Settings size={20} /> Configuración
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-grow">
          <Routes>
            <Route index element={
              <div className="animate-in fade-in duration-500">
                <header className="mb-10">
                  <h1 className="text-2xl font-bold text-slate-900">Resumen General</h1>
                  <p className="text-slate-500 font-medium">Panel de administración de Materia Digital.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {statCards.map((stat, i) => (
                    <div key={i} className="bg-white p-6 border border-slate-100 rounded-3xl">
                      <div className={`w-10 h-10 ${stat.color} bg-opacity-10 rounded-xl flex items-center justify-center mb-4`}>
                        <stat.icon className={`${stat.color.replace('bg-', 'text-')}`} size={20} />
                      </div>
                      <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                      <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="bg-white p-8 border border-slate-100 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-900">Últimos Cursos</h3>
                      <Link to="/admin/courses" className="text-sm font-bold text-slate-500 hover:text-slate-900">Ver todos</Link>
                    </div>
                    <div className="space-y-4">
                      {courses.slice(0, 3).map((course) => (
                        <div key={course.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                          <img src={course.thumbnail_url} className="w-12 h-12 bg-slate-200 rounded-lg object-cover" alt="" />
                          <div className="flex-grow">
                            <h4 className="text-sm font-bold text-slate-900">{course.title}</h4>
                            <p className="text-xs text-slate-500">{course.is_published ? 'Publicado' : 'Borrador'}</p>
                          </div>
                          <ExternalLink size={16} className="text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 border border-slate-100 rounded-3xl">
                    <h3 className="font-bold text-slate-900 mb-6">Actividad Reciente</h3>
                    <div className="space-y-6">
                      <p className="text-sm text-slate-400 italic">No hay actividad reciente registrada.</p>
                    </div>
                  </div>
                </div>
              </div>
            } />
            
            <Route path="courses" element={
              <div className="animate-in slide-in-from-right duration-500">
                <header className="flex justify-between items-center mb-10">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestor de Cursos</h1>
                    <p className="text-slate-500 font-medium">Administra tu catálogo educativo.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingCourse({});
                      setShowCourseModal(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm"
                  >
                    <Plus size={20} /> Nuevo Curso
                  </button>
                </header>

                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Curso</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Precio</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {courses.map((course) => (
                        <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={course.thumbnail_url} className="w-10 h-10 bg-slate-100 rounded-lg object-cover" alt="" />
                              <span className="font-bold text-slate-900">{course.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${course.is_published ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                              {course.is_published ? 'Publicado' : 'Borrador'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-bold">{formatPrice(course.price)}</td>
                          <td className="px-6 py-4 text-right space-x-4">
                            <button 
                              onClick={() => handleManageContent(course)}
                              className="text-slate-400 hover:text-slate-900 font-bold text-sm"
                              title="Gestionar contenido"
                            >
                              <BookOpen size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingCourse(course);
                                setShowCourseModal(true);
                              }}
                              className="text-slate-400 hover:text-slate-900 font-bold text-sm"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteCourse(course.id)}
                              className="text-red-400 hover:text-red-600 font-bold text-sm"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            } />
            <Route path="students" element={<StudentsList courses={courses} />} />
            <Route path="resources" element={<ResourcesManager courses={courses} />} />
            <Route path="settings" element={<SettingsManager />} />
          </Routes>
        </div>
      </div>

      {/* Course Modal */}
      <AnimatePresence>
        {showCourseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveCourse}>
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">{editingCourse?.id ? 'Editar Curso' : 'Nuevo Curso'}</h2>
                  <button type="button" onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-900">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título del Curso</label>
                    <input 
                      type="text" 
                      required
                      value={editingCourse?.title || ''}
                      onChange={e => setEditingCourse({...editingCourse, title: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción</label>
                    <textarea 
                      required
                      rows={3}
                      value={editingCourse?.description || ''}
                      onChange={e => setEditingCourse({...editingCourse, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precio</label>
                      <input 
                        type="number" 
                        required
                        value={editingCourse?.price || 0}
                        onChange={e => setEditingCourse({...editingCourse, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</label>
                      <select 
                        value={editingCourse?.is_published ? 'true' : 'false'}
                        onChange={e => setEditingCourse({...editingCourse, is_published: e.target.value === 'true'})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all"
                      >
                        <option value="false">Borrador</option>
                        <option value="true">Publicado</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL Imagen Portada</label>
                    <input 
                      type="url" 
                      required
                      value={editingCourse?.thumbnail_url || ''}
                      onChange={e => setEditingCourse({...editingCourse, thumbnail_url: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex justify-end gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShowCourseModal(false)}
                    className="px-6 py-3 font-bold text-slate-500 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <Save size={18} /> Guardar Curso
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Management Modal */}
      <AnimatePresence>
        {managingCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl h-[85vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Gestionar Currículo</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-slate-500 font-medium">{managingCourse.title}</p>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <button 
                      onClick={() => handleManageGlobalExam(managingCourse)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                    >
                      Configurar Examen Global
                    </button>
                  </div>
                </div>
                <button onClick={() => setManagingCourse(null)} className="text-slate-400 hover:text-slate-900 p-2">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-8 space-y-8 bg-slate-50/50">
                {modules.map((module) => (
                  <div key={module.id} className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center gap-3">
                        <span className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500">{module.order}</span>
                        {module.title}
                      </h3>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setIsAddingLesson(module.id)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                        >
                          <Plus size={14} /> Añadir Clase
                        </button>
                        <button 
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      {module.lessons?.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                              <ExternalLink size={14} className="text-accent" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{lesson.title}</p>
                              <p className="text-xs text-slate-400 font-mono">{lesson.youtube_id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleManageQuiz(lesson)}
                              className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
                            >
                              <BarChart3 size={14} /> Examen
                            </button>
                            <button 
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-slate-300 hover:text-red-400 p-2"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {isAddingLesson === module.id && (
                        <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                          <div className="space-y-4">
                            <input 
                              type="text" 
                              placeholder="Título de la clase"
                              className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                              value={newLesson.title}
                              onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                            />
                            <input 
                              type="text" 
                              placeholder="URL de YouTube (ej: https://www.youtube.com/watch?v=...)"
                              className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                              value={newLesson.youtube_url}
                              onChange={e => setNewLesson({...newLesson, youtube_url: e.target.value})}
                            />
                            <div className="flex justify-end gap-3">
                              <button 
                                onClick={() => setIsAddingLesson(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-400"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleAddLesson(module.id)}
                                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                              >
                                Guardar Clase
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isAddingModule ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
                    <input 
                      type="text" 
                      placeholder="Título del nuevo módulo"
                      className="w-full max-w-md mx-auto px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-900 mb-6 text-center text-lg font-bold"
                      value={newModuleTitle}
                      onChange={e => setNewModuleTitle(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-center gap-4">
                      <button onClick={() => setIsAddingModule(false)} className="px-6 py-3 font-bold text-slate-400">Cancelar</button>
                      <button onClick={handleAddModule} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold">Crear Módulo</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingModule(true)}
                    className="w-full py-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all font-bold flex flex-col items-center gap-2"
                  >
                    <Plus size={32} />
                    Añadir Nuevo Módulo
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingLessonQuiz && (
          <div className="fixed inset-0 z-[120] flex justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl my-auto rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Examen de Clase</h2>
                  <p className="text-sm text-slate-500 line-clamp-1">{editingLessonQuiz.lesson_title}</p>
                </div>
                <button type="button" onClick={() => setEditingLessonQuiz(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-10 overflow-y-auto custom-scrollbar">
                {editingLessonQuiz.questions.map((q, qIndex) => (
                  <div key={qIndex} className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {qIndex + 1}
                      </span>
                      <input 
                        type="text"
                        placeholder="Escribe la pregunta aquí..."
                        className="flex-grow bg-transparent border-b border-slate-200 focus:border-slate-900 py-1 font-bold focus:outline-none placeholder:text-slate-300"
                        value={q.question}
                        onChange={(e) => {
                          const newQuestions = [...editingLessonQuiz.questions];
                          newQuestions[qIndex] = { ...q, question: e.target.value };
                          setEditingLessonQuiz({ ...editingLessonQuiz, questions: newQuestions });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt: string, oIndex: number) => (
                        <div key={oIndex} className="flex items-center gap-2 group">
                          <input 
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={q.correct === oIndex}
                            className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-900"
                            onChange={() => {
                              const newQuestions = [...editingLessonQuiz.questions];
                              newQuestions[qIndex] = { ...q, correct: oIndex };
                              setEditingLessonQuiz({ ...editingLessonQuiz, questions: newQuestions });
                            }}
                          />
                          <input 
                            type="text"
                            placeholder={`Opción ${String.fromCharCode(65 + oIndex)}`}
                            className="flex-grow bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-900 transition-all placeholder:text-slate-300"
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...q.options];
                              newOptions[oIndex] = e.target.value;
                              const newQuestions = [...editingLessonQuiz.questions];
                              newQuestions[qIndex] = { ...q, options: newOptions };
                              setEditingLessonQuiz({ ...editingLessonQuiz, questions: newQuestions });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 md:p-8 bg-slate-50 flex flex-col md:flex-row justify-end gap-3 border-t border-slate-200 shrink-0">
                <button 
                  onClick={() => setEditingLessonQuiz(null)} 
                  className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition-all order-2 md:order-1"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveQuiz} 
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] order-1 md:order-2"
                >
                  Guardar Examen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingGlobalExam && (
          <div className="fixed inset-0 z-[120] flex justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl my-auto rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                    <Award size={24} /> Examen Global Final
                  </h2>
                  <p className="text-sm text-slate-500 line-clamp-1">{editingGlobalExam.course_title}</p>
                </div>
                <button type="button" onClick={() => setEditingGlobalExam(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Nota mínima para aprobar (%)</label>
                    <input 
                      type="number"
                      min="1"
                      max="100"
                      className="w-20 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 text-center"
                      value={editingGlobalExam.passing_score}
                      onChange={(e) => setEditingGlobalExam({...editingGlobalExam, passing_score: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <p className="text-[10px] text-emerald-600 font-medium">Este examen aparecerá al final del curso como requisito para obtener el certificado automático (opcional).</p>
                </div>

                <div className="space-y-10">
                  {editingGlobalExam.questions.map((q, qIndex) => (
                    <div key={qIndex} className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                          {qIndex + 1}
                        </span>
                        <input 
                          type="text"
                          placeholder="Escribe la pregunta del examen global..."
                          className="flex-grow bg-transparent border-b border-slate-200 focus:border-slate-900 py-1 font-bold focus:outline-none placeholder:text-slate-300"
                          value={q.question}
                          onChange={(e) => {
                            const newQuestions = [...editingGlobalExam.questions];
                            newQuestions[qIndex] = { ...q, question: e.target.value };
                            setEditingGlobalExam({ ...editingGlobalExam, questions: newQuestions });
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt: string, oIndex: number) => (
                          <div key={oIndex} className="flex items-center gap-2 group">
                            <input 
                              type="radio"
                              name={`global-correct-${qIndex}`}
                              checked={q.correct === oIndex}
                              className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                              onChange={() => {
                                const newQuestions = [...editingGlobalExam.questions];
                                newQuestions[qIndex] = { ...q, correct: oIndex };
                                setEditingGlobalExam({ ...editingGlobalExam, questions: newQuestions });
                              }}
                            />
                            <input 
                              type="text"
                              placeholder={`Opción ${String.fromCharCode(65 + oIndex)}`}
                              className="flex-grow bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-300"
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...q.options];
                                newOptions[oIndex] = e.target.value;
                                const newQuestions = [...editingGlobalExam.questions];
                                newQuestions[qIndex] = { ...q, options: newOptions };
                                setEditingGlobalExam({ ...editingGlobalExam, questions: newQuestions });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      setEditingGlobalExam({
                        ...editingGlobalExam,
                        questions: [...editingGlobalExam.questions, { question: '', options: ['', '', '', ''], correct: 0 }]
                      });
                    }}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:text-slate-900 hover:border-slate-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={20} /> Añadir Otra Pregunta
                  </button>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-50 flex flex-col md:flex-row justify-end gap-3 border-t border-slate-200 shrink-0">
                <button 
                  onClick={() => setEditingGlobalExam(null)} 
                  className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition-all order-2 md:order-1"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveGlobalExam} 
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-[0.98] order-1 md:order-2"
                >
                  Guardar Examen Global
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentsList({ courses }: { courses: Course[] }) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [assigningCourseId, setAssigningCourseId] = useState('');
  const [editingCert, setEditingCert] = useState<{enrollment_id: string, url: string} | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setStudents(data);
    setLoading(false);
  }

  async function fetchEnrollments(studentId: string) {
    const { data } = await supabase
      .from('enrollments')
      .select('*, courses(title), certificates(certificate_url)')
      .eq('student_id', studentId);
    if (data) setStudentEnrollments(data);
  }

  const handleAssignCourse = async () => {
    if (!selectedStudent || !assigningCourseId) return;

    const { error } = await supabase.from('enrollments').insert([
      { student_id: selectedStudent.id, course_id: assigningCourseId, status: 'active' }
    ]);

    if (error) {
      alert('El alumno ya está inscrito en este curso o hubo un error.');
    } else {
      fetchEnrollments(selectedStudent.id);
      setAssigningCourseId('');
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (confirm('¿Eliminar acceso a este curso?')) {
      await supabase.from('enrollments').delete().eq('id', enrollmentId);
      if (selectedStudent) fetchEnrollments(selectedStudent.id);
    }
  };

  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCert) return;

    const { error } = await supabase.from('certificates').upsert({
      enrollment_id: editingCert.enrollment_id,
      certificate_url: editingCert.url
    }, { onConflict: 'enrollment_id' });

    if (error) {
      console.error('Error saving certificate:', error);
      alert('Error al guardar el certificado: ' + error.message);
    } else {
      if (selectedStudent) fetchEnrollments(selectedStudent.id);
      setEditingCert(null);
    }
  };

  return (
    <div className="animate-in slide-in-from-right duration-500">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Gestor de Alumnos</h1>
        <p className="text-slate-500 font-medium">Gestiona inscripciones, accesos y certificados.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Rol</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((student) => (
                <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors ${selectedStudent?.id === student.id ? 'bg-slate-50' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-900">{student.full_name}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold uppercase tracking-widest ${student.role === 'admin' ? 'text-accent' : 'text-slate-400'}`}>
                      {student.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedStudent(student);
                        fetchEnrollments(student.id);
                      }}
                      className="text-slate-900 font-bold text-sm underline decoration-2 underline-offset-4"
                    >
                      Gestionar Cursos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-8 border border-slate-100 rounded-3xl shadow-sm h-fit sticky top-8">
          {selectedStudent ? (
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-slate-900 mb-1">{selectedStudent.full_name}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Inscripciones Activas</p>
              </div>

              <div className="space-y-4">
                {studentEnrollments.length > 0 ? studentEnrollments.map((enroll) => (
                  <div key={enroll.id} className="p-4 bg-slate-50 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{enroll.courses?.title}</span>
                      <button onClick={() => handleRemoveEnrollment(enroll.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const cert = Array.isArray(enroll.certificates) ? enroll.certificates[0] : enroll.certificates;
                          const hasCert = !!cert;
                          return (
                            <>
                              <Award size={14} className={hasCert ? 'text-emerald-500' : 'text-slate-300'} />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {hasCert ? 'Certificado Asignado' : 'Sin Certificado'}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <button 
                        onClick={() => {
                          const cert = Array.isArray(enroll.certificates) ? enroll.certificates[0] : enroll.certificates;
                          setEditingCert({ enrollment_id: enroll.id, url: cert?.certificate_url || '' });
                        }}
                        className="text-[10px] font-bold text-slate-900 hover:underline"
                      >
                        {(() => {
                          const cert = Array.isArray(enroll.certificates) ? enroll.certificates[0] : enroll.certificates;
                          return cert ? 'Editar' : 'Asignar';
                        })()}
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400 italic">Sin cursos asignados.</p>
                )}
              </div>

              <div className="pt-8 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Asignar nuevo curso</label>
                <div className="flex gap-2">
                  <select 
                    value={assigningCourseId}
                    onChange={(e) => setAssigningCourseId(e.target.value)}
                    className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                  >
                    <option value="">Seleccionar curso...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAssignCourse}
                    disabled={!assigningCourseId}
                    className="p-2 bg-slate-900 text-white rounded-xl disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <Users size={48} className="mx-auto text-slate-100 mb-4" />
              <p className="text-slate-400 font-medium">Selecciona un alumno para gestionar sus accesos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Modal */}
      <AnimatePresence>
        {editingCert && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveCertificate} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900">Asignar Certificado</h3>
                  <button type="button" onClick={() => setEditingCert(null)}><X size={20} className="text-slate-400" /></button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL del PDF / Imagen</label>
                  <input 
                    type="url" 
                    required
                    placeholder="https://ejemplo.com/certificado.pdf"
                    value={editingCert.url}
                    onChange={e => setEditingCert({...editingCert, url: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Guardar Certificado
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsManager() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('site_settings').select('*').eq('id', 1).single();
    if (data) setSettings(data);
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('site_settings').update(settings).eq('id', 1);
    alert('Ajustes guardados');
  };

  if (!settings) return null;

  return (
    <div className="animate-in slide-in-from-right duration-500">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Configuración del Sitio</h1>
      </header>
      <form onSubmit={handleSaveSettings} className="bg-white p-8 border border-slate-100 rounded-3xl shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">URL del Logo</label>
          <input 
            type="url"
            value={settings.logo_url || ''}
            onChange={e => setSettings({...settings, logo_url: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
          />
        </div>
        <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">Guardar Ajustes</button>
      </form>
    </div>
  );
}

function ResourcesManager({ courses }: { courses: Course[] }) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newResource, setNewResource] = useState({ title: '', description: '', file_url: '', course_id: '', category: 'manual' });

  useEffect(() => {
    fetchResources();
  }, []);

  async function fetchResources() {
    setLoading(true);
    const { data } = await supabase
      .from('resources')
      .select('*, courses(title)')
      .order('created_at', { ascending: false });
    if (data) setResources(data);
    setLoading(false);
  }

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('resources').insert([
      { 
        ...newResource, 
        course_id: newResource.course_id || null 
      }
    ]);

    if (!error) {
      setNewResource({ title: '', description: '', file_url: '', course_id: '', category: 'manual' });
      setIsAdding(false);
      fetchResources();
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (confirm('¿Eliminar este recurso?')) {
      await supabase.from('resources').delete().eq('id', id);
      fetchResources();
    }
  };

  return (
    <div className="animate-in slide-in-from-right duration-500">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestor de Recursos</h1>
          <p className="text-slate-500 font-medium">Manuales, plantillas y material descargable.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
          <Plus size={20} /> Nuevo Recurso
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {resources.map((res) => (
          <div key={res.id} className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                <FileText size={20} />
              </div>
              <button 
                onClick={() => handleDeleteResource(res.id)}
                className="text-slate-300 hover:text-red-400 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <h3 className="font-bold text-slate-900 mb-1">{res.title}</h3>
            <p className="text-xs text-slate-400 font-medium mb-4 line-clamp-2">{res.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {res.category}
              </span>
              {res.courses && (
                <span className="px-2 py-1 bg-blue-50 rounded text-[10px] font-bold uppercase tracking-wider text-blue-500">
                  {res.courses.title}
                </span>
              )}
            </div>
            <a 
              href={res.file_url} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"
            >
              <Download size={14} /> Descargar Archivo
            </a>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleAddResource}>
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Nuevo Recurso</h2>
                  <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-900">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-8 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título</label>
                    <input 
                      type="text" required
                      value={newResource.title}
                      onChange={e => setNewResource({...newResource, title: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción</label>
                    <textarea 
                      rows={2}
                      value={newResource.description}
                      onChange={e => setNewResource({...newResource, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoría</label>
                      <select 
                        value={newResource.category}
                        onChange={e => setNewResource({...newResource, category: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                      >
                        <option value="manual">Manual</option>
                        <option value="plantilla">Plantilla</option>
                        <option value="software">Software</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curso Relacionado (Opcional)</label>
                      <select 
                        value={newResource.course_id}
                        onChange={e => setNewResource({...newResource, course_id: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                      >
                        <option value="">General (Todos)</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL del Archivo</label>
                    <input 
                      type="url" required
                      value={newResource.file_url}
                      onChange={e => setNewResource({...newResource, file_url: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex justify-end gap-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 font-bold text-slate-500">Cancelar</button>
                  <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">Guardar Recurso</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
