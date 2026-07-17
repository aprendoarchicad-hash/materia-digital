import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        alert('Revisa tu email para confirmar el registro.');
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error en la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg text-ink selection:bg-accent selection:text-bg">
      <main className="container-custom min-h-[calc(100vh-200px)] grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-32 items-center py-24">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hero-text"
        >
          <div className="label-brutalist">
            [STATUS: {isLogin ? 'RETURNING_USER' : 'NEW_ENROLLMENT'}]
          </div>
          <h2 className="text-[clamp(4rem,10vw,8rem)] leading-[0.9] mb-8">
            {isLogin ? <>Bienvenido <br />de nuevo</> : <>Crea tu <br />acceso</>}
          </h2>
          <p className="text-lg opacity-80 max-w-[400px] leading-relaxed">
            {isLogin 
              ? "Acceso restringido. Ingresa credenciales para continuar con el sistema académico."
              : "Inicia tu formación técnica especializada en arquitectura e ingeniería."
            }
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border-2 border-ink p-8 lg:p-12"
        >
          <form onSubmit={handleAuth} className="flex flex-col gap-6">
            {!isLogin && (
              <div>
                <label className="label-brutalist">Full_Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                />
              </div>
            )}
            <div>
              <label className="label-brutalist">Email_Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-brutalist">Secure_Key</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
            </div>

            {error && (
              <p className="text-accent text-[10px] font-bold uppercase tracking-tight font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "PROCESANDO..." : (isLogin ? "Iniciar sesión" : "Registrar")}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="label-brutalist mb-4">
              {isLogin ? "¿No tienes acceso?" : "¿Ya tienes cuenta?"}
            </p>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="btn-outline w-full py-3 text-xs"
            >
              {isLogin ? "REGISTRAR" : "INICIAR_SESIÓN"}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
