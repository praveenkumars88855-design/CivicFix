import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

export default function Register() {
  const { user, register } = useAuth();
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
      await register({
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password'),
      });
      navigate('/my-reports', { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <section className="form-card">
        <h1>Create account</h1>
        <p>Join your community and help make local improvements.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Enter your name" required />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="Enter your phone number" />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Create a password (at least 8 characters)" required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? 'Creating account...' : 'Register'}</button>
        </form>
        <p className="form-footnote">Already have an account? <Link to="/login">Login</Link></p>
      </section>
    </div>
  );
}
