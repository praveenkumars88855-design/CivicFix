import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <Link to="/" className="logo">CivicFix</Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          {user && <Link to="/report">Report issue</Link>}
          {user && <Link to="/my-reports">My reports</Link>}
          {user?.role === 'citizen' && <Link to="/assistant">AI assistant</Link>}
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          {user ? (
            <>
              <span className="nav-user">{user.name}</span>
              <button type="button" className="nav-logout" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="nav-register">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
