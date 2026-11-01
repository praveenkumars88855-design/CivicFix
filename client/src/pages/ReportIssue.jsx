import { useEffect, useRef, useState } from 'react';
import LocationPicker from '../components/LocationPicker.jsx';
import API, { getApiError } from '../services/api.js';

const initialForm = { title: '', description: '', category: '' };

export default function ReportIssue() {
  const [formData, setFormData] = useState(initialForm);
  const [location, setLocation] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(photo);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!location) {
      setError('Select the issue location on the map before submitting.');
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('category', formData.category);
    data.append('location', JSON.stringify(location));
    if (photo) data.append('photo', photo);

    setSubmitting(true);
    try {
      await API.post('/issues', data);
      setFormData(initialForm);
      setLocation(null);
      setPhoto(null);
      formRef.current?.reset();
      setSuccess('Your report was submitted. AI triage has added it to your reports.');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <div className="report-page">
        <section className="form-card">
          <h1>Report an issue</h1>
          <p>Tell us about the problem and help us pinpoint its location.</p>
          <form ref={formRef} onSubmit={handleSubmit}>
            <label htmlFor="title">Issue title <span className="required-mark">*</span></label>
            <input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              minLength={5}
              maxLength={120}
              placeholder="Example: Large pothole near main gate"
              required
            />

            <label htmlFor="category">Category <span className="required-mark">*</span></label>
            <select id="category" name="category" value={formData.category} onChange={handleChange} required>
              <option value="">Select category</option>
              <option value="Road">Roads &amp; infrastructure</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Garbage">Garbage</option>
              <option value="Water">Water</option>
              <option value="Drainage">Drainage</option>
              <option value="Traffic">Traffic</option>
              <option value="Other">Other</option>
            </select>

            <label htmlFor="description">Description <span className="required-mark">*</span></label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              minLength={10}
              maxLength={3000}
              placeholder="Describe the problem and how it affects the neighborhood..."
              rows={5}
              required
            />

            <label htmlFor="photo">Upload photo <span className="optional-label">(optional, up to 5 MB)</span></label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhoto(event.target.files?.[0] || null)}
            />
            {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview of the selected issue photo" />}

            <label>Issue location <span className="required-mark">*</span></label>
            {location
              ? <p className="selected-location">Selected: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>
              : <p className="location-hint">Choose a point on the map to set the report location.</p>}

            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="form-success" role="status">{success}</p>}
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Submitting report...' : 'Submit report'}
            </button>
          </form>
        </section>
        <aside className="report-map-panel">
          <h2>Map location preview</h2>
          <p>Search for a place, use your current location, or click directly on the map.</p>
          <LocationPicker location={location} onChange={setLocation} />
        </aside>
      </div>
    </div>
  );
}
