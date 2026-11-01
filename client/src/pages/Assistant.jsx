import { useEffect, useState } from 'react';
import API, { getApiError } from '../services/api.js';
import Loading from '../components/Loading.jsx';

function getNextRequest(issue) {
  if (!issue.eligibleStage) return null;
  if (issue.escalationRequests.some((item) => item.stage === issue.eligibleStage)) return null;
  return issue.eligibleStage;
}

export default function Assistant() {
  const [cases, setCases] = useState([]);
  const [thresholds, setThresholds] = useState({ followUpDays: 15, escalationDays: 30 });
  const [assistantConfigured, setAssistantConfigured] = useState(false);
  const [providerName, setProviderName] = useState('Google Gemini');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [consent, setConsent] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [requestConsent, setRequestConsent] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [referenceDrafts, setReferenceDrafts] = useState({});
  const [savingReference, setSavingReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    API.get('/assistant/cases')
      .then(({ data }) => {
        setCases(data.cases);
        setThresholds(data.thresholds);
        setAssistantConfigured(data.assistantConfigured);
        setProviderName(data.providerName);
        if (data.cases.length) setSelectedIssueId(data.cases[0]._id);
      })
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  async function sendMessage(event) {
    event.preventDefault();
    if (!input.trim() || sending) return;
    setError('');
    setNotice('');
    setSending(true);
    const question = input.trim();
    try {
      const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
      const { data } = await API.post('/assistant/chat', {
        message: question,
        issueId: selectedIssueId || undefined,
        history,
        consent,
      });
      setMessages((current) => [
        ...current,
        { role: 'user', content: question },
        { role: 'assistant', content: data.reply },
      ]);
      setNotice(data.fallback ? data.fallbackNotice : data.privacy);
      setInput('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSending(false);
    }
  }

  async function recordRequest(issue, stage) {
    setError('');
    setNotice('');
    setRequesting(true);
    try {
      const { data } = await API.post(`/issues/${issue._id}/escalations`, {
        stage,
        consent: true,
        referenceNumber,
      });
      setCases((current) => current.map((item) => (
        item._id === issue._id ? {
          ...item,
          escalationRequests: data.issue.escalationRequests,
        } : item
      )));
      setNotice(data.notice);
      setPendingRequest(null);
      setRequestConsent(false);
      setReferenceNumber('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setRequesting(false);
    }
  }

  async function prepareDraft(issue, stage) {
    setError('');
    setNotice('');
    setLoadingDraft(true);
    try {
      const { data } = await API.post(`/issues/${issue._id}/escalations/draft`, { stage });
      setPendingRequest({ issueId: issue._id, stage, draft: data.draft });
      setRequestConsent(false);
      setReferenceNumber('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoadingDraft(false);
    }
  }

  async function saveReference(issue, request) {
    const value = referenceDrafts[request._id] || '';
    setError('');
    setNotice('');
    setSavingReference(request._id);
    try {
      const { data } = await API.patch(`/issues/${issue._id}/escalations/${request._id}/reference`, { referenceNumber: value });
      setCases((current) => current.map((item) => (
        item._id === issue._id
          ? { ...item, escalationRequests: item.escalationRequests.map((entry) => entry._id === request._id ? data.request : entry) }
          : item
      )));
      setNotice(data.notice);
      setReferenceDrafts((current) => ({ ...current, [request._id]: '' }));
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingReference('');
    }
  }

  if (loading) return <Loading />;

  return (
    <section className="page-container assistant-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CivicFix support</p>
          <h1>AI complaint assistant</h1>
          <p>Ask about your reports, status, and available follow-up steps.</p>
        </div>
      </div>

      <div className="assistant-layout">
        <section className="assistant-chat-card" aria-label="Chat with the CivicFix assistant">
          <div className="assistant-chat-heading">
            <div><span aria-hidden="true">✦</span><h2>CivicFix Assistant</h2></div>
            <p>Answers are based on your CivicFix reports.</p>
          </div>
          <div className="assistant-privacy">
            <strong>Privacy notice</strong>
            <p>Your message and relevant report details (including location, report updates, and any recorded grievance reference numbers) may be sent to {providerName} to generate replies. Your name, email, and photos are not sent. Replies may be inaccurate.</p>
            <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I understand and agree to send my message and report details to {providerName}.</label>
          </div>
          {!assistantConfigured && <p className="assistant-configuration" role="status">AI is not configured. Basic civic help and your actual report status will still work. To enable generated chat, add the selected provider key in <code>server/.env</code>.</p>}

          <div className="assistant-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="assistant-welcome">
                <strong>Hello! I can help you understand your reports.</strong>
                <p>Choose a report (or all reports), then ask about its status or what follow-up may be available.</p>
                <div className="assistant-suggestions">
                  {['What is the status of my report?', 'Can I follow up on an overdue report?'].map((suggestion) => (
                    <button type="button" key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`assistant-message ${message.role}`}>
                <span>{message.role === 'assistant' ? 'CivicFix AI' : 'You'}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {sending && <p className="assistant-thinking" role="status">CivicFix Assistant is thinking...</p>}
          </div>

          <form className="assistant-compose" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="assistant-issue">Report context</label>
            <select id="assistant-issue" value={selectedIssueId} onChange={(event) => { setSelectedIssueId(event.target.value); setMessages([]); setError(''); }}>
              <option value="">All my reports</option>
              {cases.map((item) => <option value={item._id} key={item._id}>{item.title}</option>)}
            </select>
            <label className="visually-hidden" htmlFor="assistant-message">Your question</label>
            <textarea
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about one of your reports..."
              maxLength={1000}
              rows={3}
            />
            <button type="submit" className="primary-btn" disabled={sending || !consent || !input.trim()}>
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </section>

        <aside className="assistant-case-panel">
          <h2>Your reports</h2>
          <p className="muted">Unresolved reports qualify for follow-up after {thresholds.followUpDays} days and escalation after {thresholds.escalationDays} days.</p>
          {cases.length === 0 && <p className="muted">Your reports will appear here after you submit one.</p>}
          <div className="assistant-case-list">
            {cases.map((issue) => {
              const stage = getNextRequest(issue);
              return (
                <article className="assistant-case" key={issue._id}>
                  <h3>{issue.title}</h3>
                  <p>Complaint ID: {issue._id}</p>
                  <p>{issue.category} · {issue.department}</p>
                  <p>Submitted: {new Date(issue.createdAt).toLocaleDateString()} · Status: <strong>{issue.status}</strong> · {issue.ageInDays} days old</p>
                  {issue.statusHistory?.at(-1)?.note && <p>Latest update: {issue.statusHistory.at(-1).note}</p>}
                  {stage ? (
                    pendingRequest?.issueId === issue._id && pendingRequest.stage === stage ? (
                      <div className="assistant-request-confirm">
                        <p>Review your draft. CivicFix will only record it in this app; it will not send it to an authority.</p>
                        <pre className="assistant-letter-draft">{pendingRequest.draft}</pre>
                        <label htmlFor={`reference-${issue._id}`}>Official reference number (optional, if you already submitted it yourself)</label>
                        <input id={`reference-${issue._id}`} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={100} />
                        <label><input type="checkbox" checked={requestConsent} onChange={(event) => setRequestConsent(event.target.checked)} /> I reviewed this draft and agree to record the follow-up in CivicFix.</label>
                        <button type="button" className="primary-btn" disabled={!requestConsent || requesting} onClick={() => recordRequest(issue, stage)}>
                          {requesting ? 'Recording...' : `Confirm ${stage}`}
                        </button>
                        <button type="button" className="text-button" onClick={() => { setPendingRequest(null); setRequestConsent(false); setReferenceNumber(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <button type="button" className="secondary-btn assistant-request-button" disabled={loadingDraft} onClick={() => prepareDraft(issue, stage)}>
                        {loadingDraft ? 'Preparing draft...' : `Prepare ${stage} letter`}
                      </button>
                    )
                  ) : issue.escalationRequests.length > 0 ? (
                    <div className="assistant-recorded">
                      {issue.escalationRequests.map((request) => (
                        <div className="assistant-saved-request" key={request._id}>
                          <p>Recorded: {request.stage} · {new Date(request.requestedAt).toLocaleDateString()}</p>
                          {request.referenceNumber && <p>Reference: {request.referenceNumber}</p>}
                          <label htmlFor={`saved-reference-${request._id}`}>Record an official reference number if you filed outside CivicFix</label>
                          <div className="assistant-reference-row">
                            <input
                              id={`saved-reference-${request._id}`}
                              value={referenceDrafts[request._id] || ''}
                              onChange={(event) => setReferenceDrafts((current) => ({ ...current, [request._id]: event.target.value }))}
                              maxLength={100}
                              placeholder="Optional reference number"
                            />
                            <button type="button" className="secondary-btn" disabled={!referenceDrafts[request._id]?.trim() || savingReference === request._id} onClick={() => saveReference(issue, request)}>
                              {savingReference === request._id ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                          <small>CivicFix does not verify or submit this external grievance.</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="assistant-timeline">{issue.status === 'Resolved' || issue.status === 'Verified'
                      ? 'This report is resolved.'
                      : `Follow-up becomes available after ${thresholds.followUpDays} days.`}</p>
                  )}
                </article>
              );
            })}
          </div>
        </aside>
      </div>
      <p className="assistant-authority-guidance">
        For a grievance that is eligible in Tamil Nadu, check the official CM Helpline at 1100 or
        {' '}<a href="https://cmhelpline.tnega.org/portal/en/home" target="_blank" rel="noreferrer">the official portal</a>.
        Eligibility and the correct route depend on the issue and department. CivicFix does not file it for you.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
    </section>
  );
}
