import { useCallback, useEffect, useState } from 'react';
import API, { getApiError } from '../services/api.js';
import Loading from '../components/Loading.jsx';
import PrivateIssueImage from '../components/PrivateIssueImage.jsx';

const statusOptions = ['Pending', 'AI Triaged', 'Assigned', 'In Progress', 'Reopened', 'Resolved', 'Verified'];
const roleOptions = ['citizen', 'officer', 'admin'];

function getStatusClass(status) {
  return `status status-${status.toLowerCase().replaceAll(' ', '-')}`;
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [section, setSection] = useState('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setError('');
    const [summaryResult, usersResult] = await Promise.all([
      API.get('/issues/summary'),
      API.get('/auth/users'),
    ]);
    setSummary(summaryResult.data);
    setUsers(usersResult.data.users);
  }, []);

  useEffect(() => {
    loadDashboard()
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, [loadDashboard]);

  async function updateStatus(issueId, status) {
    setError('');
    setActionMessage('');
    try {
      await API.patch(`/issues/${issueId}/status`, { status });
      await loadDashboard();
      setActionMessage('Report status updated.');
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function assignOfficer(issueId, officerId) {
    if (!officerId) return;
    setError('');
    setActionMessage('');
    try {
      await API.patch(`/issues/${issueId}/assign`, { officerId });
      await loadDashboard();
      setActionMessage('Report assigned to the selected officer.');
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function updateRole(userId, role) {
    setError('');
    setActionMessage('');
    try {
      const { data } = await API.patch(`/auth/users/${userId}/role`, { role });
      setUsers((current) => current.map((user) => (user.id === userId ? data.user : user)));
      await loadDashboard();
      setActionMessage('Account role updated.');
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  if (loading) return <Loading />;

  const statuses = summary?.statuses || {};
  const officers = summary?.officers || [];
  const maxCategoryCount = Math.max(1, ...(summary?.categories || []).map((item) => item.count));

  return (
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <p className="admin-sidebar-label">WORKSPACE</p>
        <button type="button" className={section === 'reports' ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => setSection('reports')}>
          <span aria-hidden="true">▦</span> Dashboard
        </button>
        <button type="button" className={section === 'reports' ? 'admin-nav-item' : 'admin-nav-item active'} onClick={() => setSection('users')}>
          <span aria-hidden="true">♙</span> Users
        </button>
        <p className="admin-sidebar-note">Manage civic reports, account roles, and department assignments.</p>
      </aside>

      <div className="admin-content">
        <div className="page-heading admin-heading">
          <div>
            <p className="eyebrow">CivicFix administration</p>
            <h1>{section === 'reports' ? 'Admin dashboard' : 'User management'}</h1>
            <p>Overview of civic issues and system activity.</p>
          </div>
          <button type="button" className="secondary-btn" onClick={() => loadDashboard().catch((requestError) => setError(getApiError(requestError)))}>
            Refresh data
          </button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {actionMessage && <p className="form-success" role="status">{actionMessage}</p>}

        {section === 'reports' && summary && (
          <>
            <div className="stats-grid admin-stats">
              <article className="stat-card"><p>Total reports</p><strong>{summary.total}</strong><span className="stat-icon blue">▣</span></article>
              <article className="stat-card"><p>Pending / reopened</p><strong>{(statuses.Pending || 0) + (statuses.Reopened || 0)}</strong><span className="stat-icon orange">◷</span></article>
              <article className="stat-card"><p>In progress</p><strong>{statuses['In Progress'] || 0}</strong><span className="stat-icon purple">⚒</span></article>
              <article className="stat-card"><p>Resolved</p><strong>{(statuses.Resolved || 0) + (statuses.Verified || 0)}</strong><span className="stat-icon green">✓</span></article>
            </div>

            <section className="admin-section escalation-queue">
              <h2>Citizen follow-up requests</h2>
              {!summary.escalationIssues?.length && <p className="muted">No follow-up requests have been recorded.</p>}
              <div className="admin-issue-list">
                {(summary.escalationIssues || []).flatMap((issue) => (
                  (issue.escalationRequests || []).map((request, index) => (
                    <article className="admin-escalation-request" key={`${issue._id}-${request.stage}-${index}`}>
                      <div className="admin-escalation-heading">
                        <div>
                          <h3>{issue.title}</h3>
                          <p>{request.stage === 'escalation' ? 'Escalation' : 'Follow-up'} · {issue.reportedBy?.name || 'Citizen'} · {new Date(request.requestedAt).toLocaleDateString()}</p>
                        </div>
                        <span className={getStatusClass(issue.status)}>{issue.status}</span>
                      </div>
                      <pre>{request.message}</pre>
                      {request.referenceNumber && <p className="admin-escalation-note">External reference provided by citizen: {request.referenceNumber}</p>}
                      <p className="admin-escalation-note">Recorded in CivicFix only; no external authority was contacted.</p>
                    </article>
                  ))
                ))}
              </div>
            </section>

            <div className="admin-panels">
              <section className="admin-section">
                <h2>Reports by category</h2>
                {(summary.categories.length === 0) && <p className="muted">Reports will appear here after citizens submit them.</p>}
                <div className="category-bars">
                  {summary.categories.map(({ name, count }) => (
                    <div className="category-bar-row" key={name}>
                      <span>{name}</span>
                      <div className="category-bar-track"><span style={{ width: `${(count / maxCategoryCount) * 100}%` }} /></div>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-section">
                <h2>Priority queue</h2>
                {summary.recentIssues.length === 0 && <p className="muted">No reports available yet.</p>}
                <div className="admin-issue-list">
                  {summary.recentIssues.map((issue) => (
                    <article className="admin-issue-row" key={issue._id}>
                      {issue.image
                        ? <PrivateIssueImage issueId={issue._id} imagePath={issue.image} alt="Issue evidence" />
                        : <div className="admin-image-placeholder">🏙️</div>}
                      <div className="admin-issue-main">
                        <h3>{issue.title}</h3>
                        <p>{issue.category} · {issue.reportedBy?.name || 'Citizen'}</p>
                        <span className={`priority priority-${issue.priorityLevel.toLowerCase()}`}>{issue.priorityLevel} priority</span>
                      </div>
                      <div className="admin-issue-actions">
                        <span className={getStatusClass(issue.status)}>{issue.status}</span>
                        <label className="visually-hidden" htmlFor={`status-${issue._id}`}>Update status for {issue.title}</label>
                        <select id={`status-${issue._id}`} value={issue.status} onChange={(event) => updateStatus(issue._id, event.target.value)}>
                          {statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                        <label className="visually-hidden" htmlFor={`officer-${issue._id}`}>Assign officer for {issue.title}</label>
                        <select id={`officer-${issue._id}`} value={issue.assignedOfficer?._id || ''} onChange={(event) => assignOfficer(issue._id, event.target.value)}>
                          <option value="">Assign officer...</option>
                          {officers.map((officer) => <option value={officer._id} key={officer._id}>{officer.name}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {section === 'users' && (
          <section className="admin-section users-section">
            <div className="section-heading">
              <div><h2>Accounts</h2><p className="muted">Promote trusted accounts to officer or administrator roles.</p></div>
              <span className="report-count">{users.length} users</span>
            </div>
            <div className="user-table-wrap">
              <table className="user-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <label className="visually-hidden" htmlFor={`role-${user.id}`}>Role for {user.name}</label>
                        <select id={`role-${user.id}`} value={user.role} onChange={(event) => updateRole(user.id, event.target.value)}>
                          {roleOptions.map((role) => <option value={role} key={role}>{role}</option>)}
                        </select>
                      </td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan="4">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
