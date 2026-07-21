import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, type Course, type Module, type Lesson, type Profile } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Play, CheckCircle2, Download, Menu, X, ArrowRight, Award, HelpCircle, Star } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Classroom() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<(Module & { lessons: Lesson[] })[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessonQuiz, setLessonQuiz] = useState<any>(null);
  const [lessonProgress, setLessonProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [quizActive, setQuizActive] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>(Array(5).fill(-1));
  const [quizResult, setQuizResult] = useState<{score: number, passed: boolean} | null>(null);

  const [allLessonProgress, setAllLessonProgress] = useState<Record<string, boolean>>({});
  const [certificate, setCertificate] = useState<any>(null);
  
  const [globalExam, setGlobalExam] = useState<any>(null);
  const [globalExamSubmission, setGlobalExamSubmission] = useState<any>(null);
  const [examActive, setExamActive] = useState(false);
  const [examAnswers, setExamAnswers] = useState<number[]>([]);
  const [examResult, setExamResult] = useState<{score: number, passed: boolean} | null>(null);

  const [surveySubmission, setSurveySubmission] = useState<any>(null);
  const [surveyActive, setSurveyActive] = useState(false);
  const [surveyRating, setSurveyRating] = useState(0);
  const [surveyComment, setSurveyComment] = useState('');
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
        
        // Fetch enrollment and certificate
        if (courseId) {
          console.log('Fetching enrollment for course:', courseId);
          const { data: enrollmentData, error: enrollError } = await supabase
            .from('enrollments')
            .select('*, certificates(*)')
            .eq('student_id', user.id)
            .eq('course_id', courseId)
            .maybeSingle();
          
          if (enrollError) console.error('Error fetching enrollment:', enrollError);
          console.log('Enrollment data in classroom:', enrollmentData);

          if (enrollmentData?.certificates) {
            const cert = Array.isArray(enrollmentData.certificates) 
              ? enrollmentData.certificates[0] 
              : enrollmentData.certificates;
            if (cert) setCertificate(cert);
          }

          // Fetch all lesson progress for this course
          const { data: progress } = await supabase
            .from('lesson_progress')
            .select('lesson_id, is_completed')
            .eq('student_id', user.id)
            .eq('course_id', courseId);
          
          if (progress) {
            const progressMap = progress.reduce((acc: any, curr: any) => {
              acc[curr.lesson_id] = curr.is_completed;
              return acc;
            }, {});
            setAllLessonProgress(progressMap);
          }

          // Fetch Global Exam
          const { data: examData } = await supabase
            .from('course_exams')
            .select('*')
            .eq('course_id', courseId)
            .eq('is_published', true)
            .maybeSingle();
          
          if (examData) {
            setGlobalExam(examData);
            setExamAnswers(Array(examData.questions.length).fill(-1));
            
            // Fetch Submission
            const { data: submission } = await supabase
              .from('course_exam_submissions')
              .select('*')
              .eq('course_id', courseId)
              .eq('student_id', user.id)
              .maybeSingle();
            
            setGlobalExamSubmission(submission);
          }

          // Fetch Survey Submission
          const { data: surveyData } = await supabase
            .from('course_surveys')
            .select('*')
            .eq('course_id', courseId)
            .eq('student_id', user.id)
            .maybeSingle();
          
          setSurveySubmission(surveyData);
        }
      }
    }
    init();
  }, [courseId]);

  useEffect(() => {
    if (lessonProgress) {
      setAllLessonProgress(prev => ({
        ...prev,
        [lessonProgress.lesson_id]: lessonProgress.is_completed
      }));
    }
  }, [lessonProgress]);

  useEffect(() => {
    async function fetchCourseData() {
      if (!courseId) return;
      
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
      const { data: modulesData } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order');
      const { data: lessonsData } = await supabase.from('lessons').select('*').in('module_id', (modulesData || []).map(m => m.id)).order('order');

      if (courseData) setCourse(courseData);
      
      if (modulesData && lessonsData) {
        const fullModules = modulesData.map(m => ({
          ...m,
          lessons: lessonsData.filter(l => l.module_id === m.id)
        }));
        setModules(fullModules);
        if (fullModules[0]?.lessons[0]) {
          setCurrentLesson(fullModules[0].lessons[0]);
        }
      }
      setLoading(false);
    }
    fetchCourseData();
  }, [courseId]);

  useEffect(() => {
    async function fetchLessonData() {
      if (!currentLesson || !profile) return;

      const [quizRes, progressRes] = await Promise.all([
        supabase.from('lesson_quizzes').select('*').eq('lesson_id', currentLesson.id).maybeSingle(),
        supabase.from('lesson_progress').select('*').eq('student_id', profile.id).eq('lesson_id', currentLesson.id).maybeSingle()
      ]);

      setLessonQuiz(quizRes.data);
      setLessonProgress(progressRes.data);
      setQuizActive(false);
      setQuizAnswers(Array(5).fill(-1));
      setQuizResult(null);
    }
    fetchLessonData();
  }, [currentLesson, profile]);

  const handleCompleteLesson = async (score: number = 0) => {
    if (!profile || !currentLesson || !courseId) return;

    const { error } = await supabase.from('lesson_progress').upsert({
      student_id: profile.id,
      lesson_id: currentLesson.id,
      course_id: courseId,
      is_completed: true,
      quiz_score: score
    }, { onConflict: 'student_id,lesson_id' });

    if (!error) {
      // Re-fetch progress to update UI
      const { data } = await supabase.from('lesson_progress').select('*').eq('student_id', profile.id).eq('lesson_id', currentLesson.id).maybeSingle();
      setLessonProgress(data);
    }
  };

  const handleQuizSubmit = () => {
    if (!lessonQuiz) return;
    let score = 0;
    lessonQuiz.questions.forEach((q: any, i: number) => {
      if (quizAnswers[i] === q.correct) score += 2;
    });
    
    setQuizResult({ score, passed: true });
    handleCompleteLesson(score);
  };

  const handleGlobalExamSubmit = async () => {
    if (!globalExam || !profile || !courseId) return;

    let correctCount = 0;
    globalExam.questions.forEach((q: any, i: number) => {
      if (examAnswers[i] === q.correct) correctCount++;
    });

    const score = Math.round((correctCount / globalExam.questions.length) * 100);
    const passed = score >= globalExam.passing_score;

    const { data: submission, error } = await supabase
      .from('course_exam_submissions')
      .upsert({
        student_id: profile.id,
        course_id: courseId,
        score,
        passed
      }, { onConflict: 'student_id,course_id' })
      .select()
      .single();

    if (!error) {
      setGlobalExamSubmission(submission);
      setExamResult({ score, passed });
      setExamActive(false);
      
      if (passed) {
        await supabase.from('enrollments')
          .update({ status: 'completed' })
          .eq('student_id', profile.id)
          .eq('course_id', courseId);
        
        // After passing, show survey if not done
        if (!surveySubmission) {
          setSurveyActive(true);
        }
      }
    } else {
      alert('Error al enviar el examen: ' + error.message);
    }
  };

  const handleSurveySubmit = async () => {
    if (!profile || !courseId || surveyRating === 0) return;
    setIsSubmittingSurvey(true);

    try {
      const { data, error } = await supabase
        .from('course_surveys')
        .upsert({
          student_id: profile.id,
          course_id: courseId,
          rating: surveyRating,
          comment: surveyComment
        }, { onConflict: 'student_id,course_id' })
        .select()
        .single();

      if (error) throw error;
      setSurveySubmission(data);
      setSurveyActive(false);
      alert('¡Gracias por tus comentarios! Ahora puedes descargar tu certificado.');
    } catch (err: any) {
      alert('Error al enviar la encuesta: ' + err.message);
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const canSeeCertificate = globalExamSubmission?.passed && surveySubmission;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden pt-20">
      <div className="flex-grow flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 350, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-slate-100 flex flex-col h-full bg-slate-50 shrink-0"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <h2 className="font-bold text-slate-900 line-clamp-1">{course?.title}</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-grow overflow-y-auto p-4 space-y-6">
                {modules.map((module, i) => (
                  <div key={module.id}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">
                      Módulo {i + 1}: {module.title}
                    </h3>
                    <div className="space-y-1">
                      {module.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            setCurrentLesson(lesson);
                            setExamActive(false);
                            setSurveyActive(false);
                            setQuizActive(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                            currentLesson?.id === lesson.id && !examActive && !surveyActive
                              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100" 
                              : "text-slate-500 hover:bg-slate-100/50"
                          )}
                        >
                          <div className={cn(
                            "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative",
                            currentLesson?.id === lesson.id && !examActive && !surveyActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-400"
                          )}>
                            {allLessonProgress[lesson.id] ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : (
                              <Play size={14} fill={currentLesson?.id === lesson.id && !examActive && !surveyActive ? "currentColor" : "none"} />
                            )}
                          </div>
                          <span className="text-sm font-semibold line-clamp-2">{lesson.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {globalExam && (
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setExamActive(true);
                        setCurrentLesson(null);
                        setQuizActive(false);
                        setSurveyActive(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all border-2",
                        examActive 
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-lg" 
                          : globalExamSubmission?.passed
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-white text-slate-900 border-slate-100 hover:border-emerald-200"
                      )}
                    >
                      <div className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                        examActive ? "bg-white/20" : "bg-emerald-100 text-emerald-600"
                      )}>
                        <Award size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Examen Final Global</p>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          examActive ? "text-emerald-100" : "text-slate-400"
                        )}>
                          {globalExamSubmission ? `Puntaje: ${globalExamSubmission.score}%` : "No realizado"}
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {globalExamSubmission?.passed && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setSurveyActive(true);
                        setExamActive(false);
                        setCurrentLesson(null);
                        setQuizActive(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all border-2",
                        surveyActive 
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg" 
                          : surveySubmission
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-white text-slate-900 border-slate-100 hover:border-blue-200"
                      )}
                    >
                      <div className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                        surveyActive ? "bg-white/20" : "bg-blue-100 text-blue-600"
                      )}>
                        <Star size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Encuesta de Satisfacción</p>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          surveyActive ? "text-blue-100" : "text-slate-400"
                        )}>
                          {surveySubmission ? "Completada" : "Requerida"}
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-grow flex flex-col overflow-hidden relative">
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-6 left-6 z-10 p-2 bg-white shadow-lg border border-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
            >
              <Menu size={20} />
            </button>
          )}

          <div className="flex-grow overflow-y-auto p-6 lg:p-12">
            <div className="max-w-5xl mx-auto">
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 mb-8 transition-colors">
                <ChevronLeft size={16} /> Volver a mi panel
              </Link>

              {surveyActive ? (
                <div className="animate-in slide-in-from-bottom duration-700">
                  <header className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Star size={28} />
                      </div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tight">Tu Opinión es Importante</h1>
                    </div>
                    <p className="text-slate-500 font-medium text-lg">Queremos saber qué te pareció el curso para seguir mejorando la experiencia de aprendizaje.</p>
                  </header>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 lg:p-16 shadow-sm mb-12">
                    <div className="space-y-12">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">¿Cómo calificarías este curso?</h3>
                        <div className="flex justify-center gap-4">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setSurveyRating(star)}
                              onMouseEnter={() => setSurveyRating(star)}
                              className="transition-transform active:scale-90"
                            >
                              <Star 
                                size={48} 
                                className={cn(
                                  "transition-colors",
                                  star <= surveyRating ? "text-amber-500 fill-amber-500" : "text-slate-200"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-900 uppercase tracking-widest text-center">Déjanos un comentario o testimonio</label>
                        <textarea
                          placeholder="Escribe tu experiencia aquí... ¿Qué fue lo que más te gustó? ¿Qué podríamos mejorar?"
                          className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl h-40 focus:outline-none focus:border-blue-500 transition-all text-slate-700 font-medium"
                          value={surveyComment}
                          onChange={(e) => setSurveyComment(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col items-center">
                        <button
                          disabled={surveyRating === 0 || isSubmittingSurvey}
                          onClick={handleSurveySubmit}
                          className="px-16 py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 disabled:opacity-30 disabled:cursor-not-allowed mb-6 active:scale-[0.98]"
                        >
                          {isSubmittingSurvey ? "Enviando..." : "Enviar Encuesta"}
                        </button>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                          Al completar la encuesta se habilitará tu certificado automáticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : examActive && globalExam ? (
                <div className="animate-in slide-in-from-bottom duration-700">
                  <header className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Award size={28} />
                      </div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tight">Examen Final Global</h1>
                    </div>
                    <p className="text-slate-500 font-medium text-lg">Este examen evaluará todos tus conocimientos adquiridos en el curso <strong>{course?.title}</strong>.</p>
                  </header>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 lg:p-16 shadow-sm mb-12">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preguntas</p>
                          <p className="text-2xl font-black text-slate-900">{globalExam.questions.length}</p>
                        </div>
                        <div className="w-px h-10 bg-slate-200"></div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mínimo para aprobar</p>
                          <p className="text-2xl font-black text-emerald-600">{globalExam.passing_score}%</p>
                        </div>
                      </div>
                      <div className="px-6 py-2 bg-white rounded-full border border-slate-200 font-bold text-slate-500 text-sm">
                        {examAnswers.filter(a => a !== -1).length} de {globalExam.questions.length} respondidas
                      </div>
                    </div>

                    <div className="space-y-16">
                      {globalExam.questions.map((q: any, qIndex: number) => (
                        <div key={qIndex} className="space-y-8">
                          <div className="flex gap-6">
                            <span className="shrink-0 w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200">
                              {qIndex + 1}
                            </span>
                            <h3 className="text-2xl font-bold text-slate-900 leading-tight">{q.question}</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-16">
                            {q.options.map((opt: string, oIndex: number) => (
                              <button
                                key={oIndex}
                                onClick={() => {
                                  const newAnswers = [...examAnswers];
                                  newAnswers[qIndex] = oIndex;
                                  setExamAnswers(newAnswers);
                                }}
                                className={cn(
                                  "p-6 rounded-[1.5rem] text-left font-bold transition-all border-2 text-lg",
                                  examAnswers[qIndex] === oIndex 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100 -translate-y-1" 
                                    : "bg-slate-50 text-slate-600 border-slate-50 hover:border-emerald-200 hover:bg-white"
                                )}
                              >
                                <span className={cn(
                                  "mr-4 font-black opacity-40",
                                  examAnswers[qIndex] === oIndex ? "text-emerald-200" : "text-slate-400"
                                )}>
                                  {String.fromCharCode(65 + oIndex)}.
                                </span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-20 pt-12 border-t border-slate-100 flex flex-col items-center">
                      <button
                        disabled={examAnswers.includes(-1)}
                        onClick={handleGlobalExamSubmit}
                        className="px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 disabled:opacity-30 disabled:cursor-not-allowed mb-6 active:scale-[0.98]"
                      >
                        Finalizar Examen Global
                      </button>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                        Revisa tus respuestas antes de enviar.
                      </p>
                    </div>
                  </div>
                </div>
              ) : examResult ? (
                <div className="animate-in zoom-in duration-500 text-center max-w-2xl mx-auto py-12">
                  <div className={cn(
                    "w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl",
                    examResult.passed ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-red-500 text-white shadow-red-200"
                  )}>
                    {examResult.passed ? <Award size={64} /> : <HelpCircle size={64} />}
                  </div>
                  <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
                    {examResult.passed ? '¡Examen Aprobado!' : 'Sigue intentando'}
                  </h2>
                  <p className="text-xl text-slate-500 font-medium mb-10">
                    {examResult.passed 
                      ? `Has aprobado el examen global con un puntaje de ${examResult.score}%. Solo queda un paso más para tu certificado.` 
                      : `Obtuviste un ${examResult.score}%. Necesitas al menos un ${globalExam.passing_score}% para aprobar.`}
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => {
                        setExamResult(null);
                        setExamAnswers(Array(globalExam.questions.length).fill(-1));
                        setExamActive(true);
                      }}
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                      {examResult.passed ? 'Repetir Examen' : 'Intentar de nuevo'}
                    </button>
                    {examResult.passed && !surveySubmission && (
                      <button 
                        onClick={() => {
                          setExamResult(null);
                          setSurveyActive(true);
                        }}
                        className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                      >
                        Llenar Encuesta <ArrowRight size={18} />
                      </button>
                    )}
                    {examResult.passed && canSeeCertificate && certificate && (
                      <a 
                        href={certificate.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
                      >
                        Descargar Certificado
                      </a>
                    )}
                  </div>
                </div>
              ) : currentLesson ? (
                <div className="animate-in fade-in duration-700">
                  <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl mb-8 group relative">
                    <iframe
                      src={`https://www.youtube.com/embed/${currentLesson.youtube_id}?rel=0&modestbranding=1`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
                    <div className="flex-grow">
                      <h1 className="text-3xl font-bold text-slate-900 mb-4">{currentLesson.title}</h1>
                      <div className="flex items-center gap-4 text-slate-500">
                        {lessonProgress?.is_completed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full text-xs font-bold text-emerald-600">
                            <CheckCircle2 size={12} /> Lección Completada {lessonProgress.quiz_score > 0 && `(+${lessonProgress.quiz_score} pts)`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-400">
                            <Play size={12} /> En curso
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-4">
                      {canSeeCertificate && certificate && (
                        <a
                          href={certificate.certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
                        >
                          <Award size={18} /> Mi Certificado
                        </a>
                      )}
                      {currentLesson.study_material_url && (
                        <a
                          href={currentLesson.study_material_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <Download size={18} /> Descargar Material
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Quiz Section */}
                  {!lessonProgress?.is_completed && !quizActive && (
                    <div className="mb-12 p-10 bg-slate-900 text-white rounded-[2rem] shadow-xl overflow-hidden relative group">
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <Award className="text-yellow-400" size={32} />
                          <h2 className="text-2xl font-bold">¡Pon a prueba lo aprendido!</h2>
                        </div>
                        <p className="text-slate-300 mb-8 max-w-xl">
                          {lessonQuiz 
                            ? "Responde 5 preguntas cortas para completar esta lección y sumar puntos a tu progreso." 
                            : "Marca esta lección como completada para seguir avanzando en tu curso."}
                        </p>
                        <button 
                          onClick={() => lessonQuiz ? setQuizActive(true) : handleCompleteLesson()}
                          className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {lessonQuiz ? "Comenzar Examen" : "Marcar como Completada"}
                        </button>
                      </div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
                    </div>
                  )}

                  {quizActive && lessonQuiz && (
                    <div className="mb-12 p-8 lg:p-12 bg-white border border-slate-100 rounded-[2rem] shadow-sm animate-in slide-in-from-bottom duration-500">
                      <div className="flex justify-between items-center mb-10">
                        <h2 className="text-2xl font-bold text-slate-900">Examen de Clase</h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
                          {quizAnswers.filter(a => a !== -1).length} de 5 respondidas
                        </span>
                      </div>

                      <div className="space-y-12">
                        {lessonQuiz.questions.map((q: any, qIndex: number) => (
                          <div key={qIndex} className="space-y-6">
                            <div className="flex gap-4">
                              <span className="shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-xs">
                                {qIndex + 1}
                              </span>
                              <h3 className="text-lg font-bold text-slate-900 pt-1">{q.question}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
                              {q.options.map((opt: string, oIndex: number) => (
                                <button
                                  key={oIndex}
                                  onClick={() => {
                                    const newAnswers = [...quizAnswers];
                                    newAnswers[qIndex] = oIndex;
                                    setQuizAnswers(newAnswers);
                                  }}
                                  className={cn(
                                    "p-4 rounded-2xl text-left font-semibold transition-all border",
                                    quizAnswers[qIndex] === oIndex 
                                      ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                                      : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                                  )}
                                >
                                  <span className="mr-3 opacity-50">{String.fromCharCode(65 + oIndex)}.</span>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-12 pt-10 border-t border-slate-100 flex flex-col items-center">
                        <button
                          disabled={quizAnswers.includes(-1)}
                          onClick={handleQuizSubmit}
                          className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl disabled:opacity-30 disabled:cursor-not-allowed mb-4"
                        >
                          Enviar Examen
                        </button>
                        <p className="text-sm text-slate-400 font-medium italic">
                          * Cada pregunta correcta vale 2 puntos.
                        </p>
                      </div>
                    </div>
                  )}

                  {quizResult && (
                    <div className="mb-12 p-10 bg-emerald-50 border border-emerald-100 rounded-[2rem] text-center animate-in zoom-in duration-500">
                      <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                        <CheckCircle2 size={40} />
                      </div>
                      <h2 className="text-3xl font-bold text-emerald-900 mb-2">¡Lección Completada!</h2>
                      <p className="text-emerald-700 font-medium mb-8">Has obtenido una puntuación de {quizResult.score}/10 puntos.</p>
                      <button 
                        onClick={() => setQuizResult(null)}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md"
                      >
                        Cerrar Resultado
                      </button>
                    </div>
                  )}

                  {(() => {
                    const allLessons = modules.flatMap(m => m.lessons);
                    const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
                    const nextLesson = allLessons[currentIndex + 1];

                    if (!nextLesson) return null;

                    return (
                      <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Siguiente lección</p>
                          <h4 className="font-bold text-slate-900">{nextLesson.title}</h4>
                        </div>
                        <button 
                          onClick={() => {
                            setCurrentLesson(nextLesson);
                            setExamActive(false);
                            setSurveyActive(false);
                            setQuizActive(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all group"
                        >
                          Siguiente <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-32">
                  <Play className="mx-auto text-slate-200 mb-6" size={64} />
                  <h3 className="text-xl font-bold text-slate-900">Selecciona una lección</h3>
                  <p className="text-slate-500">Elige un video de la barra lateral para comenzar a aprender.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
