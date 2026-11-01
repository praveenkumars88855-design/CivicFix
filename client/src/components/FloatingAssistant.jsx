import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import API, { getApiError } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const quickQuestions = [
  ['Check Complaint Status', 'What is the status of my complaint?'],
  ['My Complaint Is Delayed', 'Is any of my unresolved complaint delayed or eligible for follow-up?'],
  ['Escalation Options', 'What escalation options are available for my complaint?'],
];

export default function FloatingAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const isCitizen = user?.role === 'citizen';
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [casesLoaded, setCasesLoaded] = useState(false);
  const [providerName, setProviderName] = useState('the configured AI provider');
  const [issueId, setIssueId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fallbackNotice, setFallbackNotice] = useState('');

  useEffect(() => {
    setCases([]);
    setCasesLoaded(false);
    setIssueId('');
    setMessages([]);
    setConsent(false);
    setError('');
    setProviderName('the configured AI provider');
  }, [user?.role]);

  useEffect(() => {
    if (!open || casesLoaded || loadingCases) return;
    if (!isCitizen) {
      setCasesLoaded(true);
      return;
    }
    setLoadingCases(true);
    API.get('/assistant/cases')
      .then(({ data }) => {
        setCases(data.cases);
        setProviderName(data.providerName);
        if (data.cases.length) setIssueId(data.cases[0]._id);
      })
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => { setLoadingCases(false); setCasesLoaded(true); });
  }, [open, casesLoaded, loadingCases, isCitizen]);

  if (location.pathname === '/assistant') return null;

  async function sendQuestion(question) {
    if (!question.trim() || sending) return;
    setError('');
    setFallbackNotice('');
    setSending(true);
    try {
      const { data } = await API.post(isCitizen ? '/assistant/chat' : '/assistant/public-chat', {
        message: question.trim(),
        ...(isCitizen && issueId ? { issueId } : {}),
        history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
        consent,
      });
      setMessages((current) => [
        ...current,
        { role: 'user', content: question.trim() },
        { role: 'assistant', content: data.reply },
      ]);
      setFallbackNotice(data.fallbackNotice || '');
      setProviderName(data.providerName || providerName);
      setText('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSending(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    void sendQuestion(text);
  }

  return (
    <div className="floating-assistant">
      {open && (
        <section className="floating-chat" aria-label="CivicFix AI chat">
          <header className="floating-chat-header">
            <div><strong>CivicFix AI</strong><span>Your civic support assistant</span></div>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="floating-privacy">
            <label>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              {isCitizen
                ? `Send my messages and report details, updates, and any saved grievance references to ${providerName}. My name, email, and photos are not sent.`
                : `Send my message to ${providerName} for a reply. Do not include private or sensitive information.`}
            </label>
          </div>
          {isCitizen && (
            <>
              <label className="visually-hidden" htmlFor="floating-report-context">Complaint context</label>
              <select
                id="floating-report-context"
                className="floating-report-select"
                value={issueId}
                onChange={(event) => { setIssueId(event.target.value); setMessages([]); }}
                disabled={loadingCases}
              >
                <option value="">All my reports</option>
                {cases.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
              </select>
            </>
          )}
          <div className="floating-quick-actions">
            <Link to="/report" onClick={() => setOpen(false)}>Report an Issue</Link>
            {quickQuestions.map(([label, question]) => (
              isCitizen
                ? <button type="button" key={label} disabled={!consent || sending} onClick={() => void sendQuestion(question)}>{label}</button>
                : <Link key={label} to="/login">{label} · Sign in</Link>
            ))}
          </div>
          <div className="floating-messages" aria-live="polite">
            {!messages.length && <p className="floating-welcome">Ask about civic issues, your report status, delays, or escalation options. Tamil is supported by the AI provider.</p>}
            {messages.map((message, index) => (
              <article className={`floating-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === 'assistant' ? 'CivicFix AI' : 'You'}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {sending && <p className="assistant-thinking" role="status">Thinking...</p>}
            {fallbackNotice && <p className="assistant-configuration" role="status">{fallbackNotice}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <form className="floating-compose" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="floating-message">Message</label>
            <textarea id="floating-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask CivicFix..." rows={2} maxLength={1000} />
            <button className="primary-btn" type="submit" disabled={!consent || !text.trim() || sending}>Send</button>
          </form>
          {isCitizen
            ? <Link className="floating-full-chat" to="/assistant" onClick={() => setOpen(false)}>Open full assistant &amp; report history</Link>
            : <Link className="floating-full-chat" to="/login" onClick={() => setOpen(false)}>Sign in to check your reports</Link>}
          <a className="floating-tamilnadu-link" href="https://cmhelpline.tnega.org/portal/en/home" target="_blank" rel="noreferrer">Tamil Nadu grievance portal (check eligibility)</a>
        </section>
      )}
      <button
        type="button"
        className="floating-assistant-toggle"
        aria-expanded={open}
        aria-label={open ? 'Close CivicFix AI assistant' : 'Open CivicFix AI assistant'}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? '×' : '✦'}<span>{open ? 'Close' : 'Ask CivicFix AI'}</span>
      </button>
    </div>
  );
}
