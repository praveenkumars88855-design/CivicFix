import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/my-reports'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      const authenticatedUser = await login({
        email: formData.get('email'),
        password: formData.get('password'),
      });
      const requestedPath = location.state?.from?.pathname;
      const destination = authenticatedUser.role === 'admin'
        ? '/admin'
        : requestedPath?.startsWith('/') && !requestedPath.startsWith('//') && requestedPath !== '/login'
          ? requestedPath
          : '/my-reports';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <section className="form-card">
        <h1>Login</h1>
        <p>Sign in to CivicFix to manage your reports.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Login'}</button>
        </form>
        <p className="form-footnote">New to CivicFix? <Link to="/register">Create an account</Link></p>
      </section>
    </div>
  );
}
