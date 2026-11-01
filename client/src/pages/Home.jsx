import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <p className="badge">AI-powered civic platform</p>
          <h1>Report local problems.<br />Make your community better.</h1>
          <p>
            CivicFix helps citizens report potholes, broken streetlights,
            garbage, water leaks, and other local infrastructure problems.
          </p>
          <div className="hero-buttons">
            <Link to="/report" className="primary-btn">Report an issue</Link>
            <Link to="/my-reports" className="secondary-btn">Track my reports</Link>
          </div>
        </div>
      </section>

      <section className="features" aria-label="How CivicFix works">
        <article className="feature-card">
          <span aria-hidden="true">📸</span>
          <h2>Report</h2>
          <p>Upload a photo and describe the local problem.</p>
        </article>
        <article className="feature-card">
          <span aria-hidden="true">🤖</span>
          <h2>AI triage</h2>
          <p>AI helps classify and prioritize civic issues.</p>
        </article>
        <article className="feature-card">
          <span aria-hidden="true">📍</span>
          <h2>Track</h2>
          <p>Track your issue from reporting to resolution.</p>
        </article>
      </section>
    </div>
  );
}
