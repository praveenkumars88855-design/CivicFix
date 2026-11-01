import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const DEFAULT_CENTER = [20.5937, 78.9629];

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng, address: '' });
    },
  });
  return null;
}

function MapViewport({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.setView([location.latitude, location.longitude], 15);
  }, [location, map]);
  return null;
}

export default function LocationPicker({ location, onChange }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  async function searchLocation(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '1' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error(`Location search failed (${response.status})`);
      const results = await response.json();
      if (!results.length) {
        setError('No matching place found. Try a nearby landmark or select a point on the map.');
        return;
      }
      onChange({
        latitude: Number(results[0].lat),
        longitude: Number(results[0].lon),
        address: results[0].display_name,
      });
    } catch (searchError) {
      setError(searchError.message || 'Could not search locations. Select a point on the map instead.');
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('Location access is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onChange({ latitude: coords.latitude, longitude: coords.longitude, address: '' }),
      () => setError('Could not get your location. Allow location access or select a point on the map.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const center = location ? [location.latitude, location.longitude] : DEFAULT_CENTER;

  return (
    <div className="location-picker">
      <form className="location-search" onSubmit={searchLocation}>
        <label className="visually-hidden" htmlFor="location-search">Search for an address or landmark</label>
        <input
          id="location-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for an address or landmark..."
        />
        <button className="secondary-btn" type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>
      <div className="map-frame" aria-label="Select a location on the map">
        <MapContainer center={center} zoom={location ? 15 : 5} scrollWheelZoom className="issue-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={onChange} />
          <MapViewport location={location} />
          {location && <CircleMarker center={[location.latitude, location.longitude]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }} />}
        </MapContainer>
      </div>
      <div className="location-controls">
        <p>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Click the map to choose the issue location.'}</p>
        <button className="secondary-btn" type="button" onClick={useCurrentLocation}>Use my location</button>
      </div>
      {location?.address && <p className="location-address">{location.address}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
