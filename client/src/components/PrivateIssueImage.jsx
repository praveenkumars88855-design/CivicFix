import { useEffect, useState } from 'react';
import API from '../services/api.js';

export default function PrivateIssueImage({ issueId, imagePath, alt = '', className }) {
  const [source, setSource] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!imagePath) {
      setSource('');
      setUnavailable(false);
      return undefined;
    }
    const filename = imagePath.split('/').at(-1);
    let objectUrl;
    let cancelled = false;
    API.get(`/issues/${issueId}/photos/${encodeURIComponent(filename)}`, { responseType: 'blob' })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        if (!cancelled) {
          setUnavailable(false);
          setSource(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSource('');
          setUnavailable(true);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath, issueId]);

  if (unavailable) return <span className="private-image-unavailable" role="status">Evidence unavailable</span>;
  if (!source) return null;
  return <img className={className} src={source} alt={alt} />;
}
