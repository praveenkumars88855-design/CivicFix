import { useEffect, useMemo, useState } from 'react';
import API, { getApiError } from '../services/api.js';
import Loading from '../components/Loading.jsx';
import PrivateIssueImage from '../components/PrivateIssueImage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const filters = ['All Reports', 'Pending', 'In Progress', 'Resolved'];

function statusClass(status) {
  return `status status-${status.toLowerCase().replaceAll(' ', '-')}`;
}

export default function MyReports() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('All Reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [verifying, setVerifying] = useState('');
  const [reviewIssue, setReviewIssue] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    API.get('/issues')
      .then(({ data }) => setIssues(data.issues))
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const filteredIssues = useMemo(
    () => filter === 'All Reports'
      ? issues
      : issues.filter((issue) => filter === 'Pending'
      ? ['Pending', 'AI Triaged', 'Reopened'].includes(issue.status)
        : issue.status === filter),
    [filter, issues],
  );

  async function verifyReport(id) {
    setActionError('');
    setVerifying(id);
    try {
      const { data } = await API.patch(`/issues/${id}/verify`);
      setIssues((current) => current.map((issue) => (issue._id === id ? data.issue : issue)));
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setVerifying('');
    }
  }

  async function requestReview(event) {
    event.preventDefault();
    if (!reviewIssue) return;
    setActionError('');
    setReopening(true);
    const body = new FormData();
    body.append('note', reviewNote);
    if (reviewPhoto) body.append('photo', reviewPhoto);
    try {
      const { data } = await API.post(`/issues/${reviewIssue}/reopen`, body);
      setIssues((current) => current.map((issue) => (issue._id === reviewIssue ? data.issue : issue)));
      setReviewIssue(null);
      setReviewNote('');
      setReviewPhoto(null);
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setReopening(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <section className="page-container reports-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your community dashboard</p>
          <h1>{user.role === 'officer' ? 'Assigned reports' : 'My reports'}</h1>
          <p>{user.role === 'officer' ? 'Review and update reports assigned to you.' : 'View and track all your reported issues.'}</p>
        </div>
        <span className="report-count">{issues.length} {issues.length === 1 ? 'report' : 'reports'}</span>
      </div>

      <div className="report-filters" role="group" aria-label="Filter reports by status">
        {filters.map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setFilter(status)}
          >
            {status}
            {status === 'All Reports' && <span>{issues.length}</span>}
          </button>
        ))}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {!error && filteredIssues.length === 0 && (
        <div className="empty-state">
          <span aria-hidden="true">📋</span>
          <h2>{issues.length ? 'No reports in this status' : 'No reports yet'}</h2>
          <p>{issues.length ? 'Choose a different filter to see your reports.' : 'Your submitted civic issues will appear here.'}</p>
        </div>
      )}

      <div className="reports-list">
        {filteredIssues.map((issue) => (
          <article className="report-card report-card-detailed" key={issue._id}>
            {issue.image
              ? <PrivateIssueImage issueId={issue._id} imagePath={issue.image} className="report-thumbnail" alt="Issue evidence" />
              : <div className="report-thumbnail image-placeholder" aria-hidden="true">🏙️</div>}
            <div className="report-details">
              <div className="report-title-row">
                <h2>{issue.title}</h2>
                <span className={statusClass(issue.status)}>{issue.status}</span>
              </div>
              <p>{issue.category} · {issue.department}</p>
              {issue.location?.address && <p>📍 {issue.location.address}</p>}
              {issue.location?.latitude != null && (
                <p>📍 {issue.location.latitude.toFixed(4)}, {issue.location.longitude.toFixed(4)}</p>
              )}
              <div className="report-meta">
                <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                <span className={`priority priority-${issue.priorityLevel.toLowerCase()}`}>{issue.priorityLevel} priority</span>
              </div>
              {issue.aiReason && <p className="ai-note">{issue.aiReason}</p>}
              {issue.duplicateOf && <p className="ai-note">This may be a duplicate of “{issue.duplicateOf.title}”.</p>}
              {issue.statusHistory?.length > 0 && (
                <details className="report-history">
                  <summary>Report updates ({issue.statusHistory.length})</summary>
                  <ol>
                    {issue.statusHistory.slice().reverse().map((update, index) => (
                      <li key={`${update._id || update.updatedAt}-${index}`}>
                        <strong>{update.status}</strong> · {new Date(update.updatedAt).toLocaleString()}
                        {update.note && <p>{update.note}</p>}
                        {update.evidenceImage && (
                          <PrivateIssueImage
                            issueId={issue._id}
                            imagePath={update.evidenceImage}
                            className="review-evidence"
                            alt="Evidence uploaded with this report update"
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {issue.status === 'Resolved' && user.role === 'citizen' && (
                <div className="report-resolution-actions">
                  <button type="button" className="verify-btn" disabled={verifying === issue._id} onClick={() => verifyReport(issue._id)}>
                    {verifying === issue._id ? 'Confirming...' : 'Confirm resolution'}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => { setReviewIssue(issue._id); setActionError(''); }}>
                    Still unresolved? Request review
                  </button>
                </div>
              )}
              {issue.status === 'Verified' && user.role === 'citizen' && (
                <button type="button" className="secondary-btn" onClick={() => { setReviewIssue(issue._id); setActionError(''); }}>
                  Problem returned? Request review
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {reviewIssue && (
        <form className="review-request-form" onSubmit={requestReview}>
          <h2>Request a resolution review</h2>
          <p>Tell the assigned team why the issue remains or has become unresolved. Your update and optional evidence will be added to the report history.</p>
          <label htmlFor="review-note">What still needs attention?</label>
          <textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} minLength={10} maxLength={1000} rows={4} required />
          <label htmlFor="review-photo">Add updated evidence (optional, JPG/PNG/WebP, up to 5 MB)</label>
          <input id="review-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReviewPhoto(event.target.files?.[0] || null)} />
          <div className="review-actions">
            <button type="submit" className="primary-btn" disabled={reopening || reviewNote.trim().length < 10}>{reopening ? 'Submitting...' : 'Reopen for review'}</button>
            <button type="button" className="secondary-btn" disabled={reopening} onClick={() => { setReviewIssue(null); setReviewNote(''); setReviewPhoto(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
