import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let userData;
      if (isRegistering) {
        const res = await register(fullName, email, password, location);
        userData = res.user;
      } else {
        const res = await login(email, password);
        userData = res.user;
      }
      if (userData?.role === 'admin') {
        localStorage.removeItem('selectedIndustry');
        navigate('/users');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gray-800 text-white text-xl font-black mb-4 shadow-lg transition-colors">
            PI
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-wide">
            Production Intelligence & Monitoring System
          </h1>
          <p className="text-gray-500 text-sm mt-2">MSME Factory Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="ind-panel bg-white shadow-xl border border-gray-200 rounded-xl p-6 transition-colors">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center">
            {isRegistering ? 'Create Account' : 'Secure Access'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
          )}

          {isRegistering && (
            <>
              <div className="mb-4">
                <label className="label">Full Name</label>
                <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="mb-4">
                <label className="label">Location</label>
                <input type="text" className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} required />
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="label">Email</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-6">
            <label className="label">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Authenticating...' : (isRegistering ? 'Sign Up' : 'Login')}
          </button>
          
          <p className="mt-4 text-center text-sm text-gray-500">
            {isRegistering ? (
              <>Already have an account? <span className="text-gray-800 font-bold cursor-pointer hover:underline" onClick={() => setIsRegistering(false)}>Login</span></>
            ) : (
              <>New to PMRS? <span className="text-gray-800 font-bold cursor-pointer hover:underline" onClick={() => setIsRegistering(true)}>Sign up</span></>
            )}
          </p>


        </form>
      </div>
    </div>
  );
}
