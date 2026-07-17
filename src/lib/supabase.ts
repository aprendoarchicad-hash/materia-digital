import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create the client if the URL is provided, otherwise export a proxy or handle it gracefully
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as ReturnType<typeof createClient>, {
      get: () => {
        throw new Error('Supabase URL y Anon Key son requeridos. Por favor, configúralos en los Secrets del proyecto.');
      }
    });


export type Profile = {
  id: string;
  role: 'admin' | 'student';
  full_name: string;
  avatar_url: string;
  whatsapp: string;
  created_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_published: boolean;
  price: number;
  created_at: string;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  order: number;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  youtube_id: string;
  study_material_url: string;
  order: number;
};

export type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed';
  payment_status: 'pending' | 'paid';
  progress_percent: number;
  enrolled_at: string;
};

export type Resource = {
  id: string;
  course_id: string | null;
  title: string;
  description: string;
  file_url: string;
  category: string;
  created_at: string;
};

export type Certificate = {
  id: string;
  enrollment_id: string;
  certificate_url: string;
  issued_at: string;
};
