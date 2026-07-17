import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ConfirmEmail() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="border-4 border-ink bg-white p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="w-20 h-20 bg-accent border-4 border-ink rounded-full flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CheckCircle2 size={40} className="text-ink" />
          </div>
          
          <div className="label-brutalist mb-4 inline-block">SISTEMA_VERIFICADO</div>
          
          <h1 className="text-4xl md:text-5xl font-black text-ink leading-none mb-6">
            ¡BIENVENIDO A MATERIA DIGITAL!
          </h1>
          
          <p className="text-lg font-medium text-ink/70 mb-10 leading-snug">
            Tu correo ha sido confirmado con éxito. Ahora tienes acceso total a nuestra plataforma de aprendizaje especializado.
          </p>

          <Link 
            to="/auth" 
            className="group flex items-center justify-center gap-3 w-full py-5 bg-ink text-bg font-black text-xl hover:bg-accent hover:text-ink transition-all active:scale-95 border-b-4 border-r-4 border-black"
          >
            INICIAR SESIÓN
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs font-bold text-ink/40 uppercase tracking-widest">
            © 2026 MATERIA DIGITAL • ESTUDIO DE DISEÑO & TECNOLOGÍA
          </p>
        </div>
      </motion.div>
    </div>
  );
}
