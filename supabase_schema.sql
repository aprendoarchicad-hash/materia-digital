-- MATERIA DIGITAL - SCHEMA (INCREMENTAL & SAFE)
-- Este script crea las tablas y políticas necesarias sin borrar datos existentes.

-- 1. TIPOS (Solo se crean si no existen)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLAS BASE

-- Tabla de Roles Interna (CLAVE: Sin RLS para romper la recursión)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfiles de Usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'student' NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cursos
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  price NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulos
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lecciones
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_id TEXT,
  study_material_url TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscripciones
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  status enrollment_status DEFAULT 'active',
  payment_status payment_status DEFAULT 'pending',
  progress_percent NUMERIC(5, 2) DEFAULT 0.00,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- Entregas
CREATE TABLE IF NOT EXISTS public.student_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificados
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE UNIQUE,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recursos (Manuales, Plantillas, etc.)
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes por lección
CREATE TABLE IF NOT EXISTS public.lesson_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE UNIQUE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progreso de lecciones por alumno
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT TRUE,
  quiz_score INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, lesson_id)
);

-- Ajustes del sitio
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_title TEXT,
  hero_subtitle TEXT,
  whatsapp_support TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  logo_url TEXT,
  stats_manual JSONB DEFAULT '{"students": 0, "courses": 0, "certificates": 0}'::jsonb,
  faqs JSONB DEFAULT '[]'::jsonb,
  benefits JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUNCIONES Y TRIGGERS (SECURITY DEFINER)

-- Función is_admin (Consulta tanto user_roles como profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sincronización automática de roles
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, updated_at)
  VALUES (NEW.id, NEW.role, NOW())
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_role_sync ON public.profiles;
CREATE TRIGGER on_profile_role_sync
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_role();

-- Perfil automático al registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Función para actualizar el progreso del curso
CREATE OR REPLACE FUNCTION public.update_course_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_student_id UUID;
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
BEGIN
  v_course_id := NEW.course_id;
  v_student_id := NEW.student_id;

  -- Contar lecciones totales del curso
  SELECT COUNT(*) INTO v_total_lessons
  FROM public.lessons l
  JOIN public.modules m ON l.module_id = m.id
  WHERE m.course_id = v_course_id;

  -- Contar lecciones completadas por el alumno en este curso
  SELECT COUNT(*) INTO v_completed_lessons
  FROM public.lesson_progress
  WHERE student_id = v_student_id AND course_id = v_course_id AND is_completed = TRUE;

  -- Actualizar enrolamiento
  IF v_total_lessons > 0 THEN
    UPDATE public.enrollments
    SET progress_percent = (v_completed_lessons::NUMERIC / v_total_lessons::NUMERIC) * 100
    WHERE student_id = v_student_id AND course_id = v_course_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_lesson_completed ON public.lesson_progress;
CREATE TRIGGER on_lesson_completed
  AFTER INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE PROCEDURE public.update_course_progress();

-- 4. SEGURIDAD (RLS)

ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas para evitar duplicados
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- POLÍTICAS
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.is_admin());

CREATE POLICY "courses_select_public" ON public.courses FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "courses_admin_all" ON public.courses FOR ALL USING (public.is_admin());

CREATE POLICY "modules_select_enrolled" ON public.modules FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = auth.uid() AND course_id = modules.course_id)
);
CREATE POLICY "modules_admin_all" ON public.modules FOR ALL USING (public.is_admin());

CREATE POLICY "lessons_select_enrolled" ON public.lessons FOR SELECT USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.modules m 
    JOIN public.enrollments e ON m.course_id = e.course_id 
    WHERE m.id = lessons.module_id AND e.student_id = auth.uid()
  )
);
CREATE POLICY "lessons_admin_all" ON public.lessons FOR ALL USING (public.is_admin());

CREATE POLICY "enrollments_select_own" ON public.enrollments FOR SELECT USING (student_id = auth.uid() OR public.is_admin());
CREATE POLICY "enrollments_admin_all" ON public.enrollments FOR ALL USING (public.is_admin());

CREATE POLICY "submissions_student_all" ON public.student_submissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE id = enrollment_id AND student_id = auth.uid())
);
CREATE POLICY "submissions_admin_all" ON public.student_submissions FOR ALL USING (public.is_admin());

-- POLÍTICAS DE CERTIFICADOS
CREATE POLICY "certificates_select_all" ON public.certificates FOR SELECT USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.enrollments e 
    WHERE e.id = public.certificates.enrollment_id 
    AND e.student_id = auth.uid()
  )
);
CREATE POLICY "certificates_admin_all" ON public.certificates FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLÍTICAS DE RECURSOS
CREATE POLICY "resources_select_enrolled" ON public.resources FOR SELECT USING (
  public.is_admin() OR course_id IS NULL OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = resources.course_id AND student_id = auth.uid())
);
CREATE POLICY "resources_admin_all" ON public.resources FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLÍTICAS DE QUIZZES
CREATE POLICY "quizzes_select_enrolled" ON public.lesson_quizzes FOR SELECT USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON l.module_id = m.id
    JOIN public.enrollments e ON m.course_id = e.course_id
    WHERE l.id = lesson_quizzes.lesson_id AND e.student_id = auth.uid()
  )
);
CREATE POLICY "quizzes_admin_all" ON public.lesson_quizzes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLÍTICAS DE PROGRESO DE LECCIÓN
CREATE POLICY "progress_select_own" ON public.lesson_progress FOR SELECT USING (student_id = auth.uid() OR public.is_admin());
CREATE POLICY "progress_insert_own" ON public.lesson_progress FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "progress_update_own" ON public.lesson_progress FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "settings_select_public" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_all" ON public.site_settings FOR ALL USING (public.is_admin());

-- 5. EXÁMENES GLOBALES
CREATE TABLE IF NOT EXISTS public.course_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  passing_score INTEGER DEFAULT 70,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.course_exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- 6. ENCUESTAS DE SATISFACCIÓN
CREATE TABLE IF NOT EXISTS public.course_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

ALTER TABLE public.course_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_select_enrolled" ON public.course_exams FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = course_exams.course_id AND student_id = auth.uid())
);
CREATE POLICY "exams_admin_all" ON public.course_exams FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "exam_submissions_select_own" ON public.course_exam_submissions FOR SELECT USING (student_id = auth.uid() OR public.is_admin());
CREATE POLICY "exam_submissions_insert_own" ON public.course_exam_submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "exam_submissions_update_own" ON public.course_exam_submissions FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "surveys_select_public" ON public.course_surveys FOR SELECT USING (true);
CREATE POLICY "surveys_insert_own" ON public.course_surveys FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "surveys_update_own" ON public.course_surveys FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- 7. SEMILLA
INSERT INTO public.site_settings (id, hero_title, hero_subtitle)
VALUES (1, 'Aprende Software para Arquitectura e Ingeniería', 'Cursos especializados en BIM, CAD y nuevas tecnologías.')
ON CONFLICT (id) DO NOTHING;
