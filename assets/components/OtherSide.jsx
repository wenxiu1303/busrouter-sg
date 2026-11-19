import { h, Fragment } from 'preact';
import { useState, useMemo } from 'preact/hooks';

import { servicesAtStop, isRightSide } from '../utils/otherSide';

const stopLabel = (stops, code) => `${stops[code]?.[2] || code} (${code})`;

const stopName = (stops, code) => stops[code]?.[2] || code;

// Tappable card that jumps to the stop across the road.
function OppositeCard({ stops, opposite }) {
  if (!opposite) return null;
  return (
    <a class="os-card" href={`#${opposite.code}`}>
      <span class="os-kicker">Other side of the road</span>
      <span class="os-main">
        <span class="os-chip">{opposite.code}</span>
        <span class="os-name">{stopName(stops, opposite.code)}</span>
      </span>
      <span class="os-meta">{Math.round(opposite.meters)} m away</span>
      <span class="os-chevron" aria-hidden="true">›</span>
    </a>
  );
}

function SideCheck({ stops, services, code, opposite }) {
  const options = useMemo(() => servicesAtStop(services, code), [services, code]);
  const [svc, setSvc] = useState('');
  const [destInput, setDestInput] = useState('');

  // Candidate destinations: every stop on either direction of the chosen service.
  const destinations = useMemo(() => {
    if (!svc) return [];
    const codes = new Set(services[svc].routes.flat());
    codes.delete(code);
    return [...codes];
  }, [svc, services, code]);

  // Accept "Name (12345)" from the datalist or a bare 5-digit code.
  const destination = (destInput.match(/(\d{5})\)?\s*$/) || [])[1];
  const result =
    svc && destination ? isRightSide(services[svc].routes, code, destination) : null;

  if (!options.length) return null;

  return (
    <form class="side-check" onSubmit={(e) => e.preventDefault()}>
      <div class="sc-title">Am I on the right side?</div>
      <div class="sc-row">
        <label class="sc-select">
          <span class="sr-only">Bus</span>
          <select value={svc} onInput={(e) => setSvc(e.target.value)}>
            <option value="">Bus</option>
            {options.map((s) => (
              <option value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label class="sc-input">
          <span class="sr-only">Destination stop</span>
          <input
            list="side-check-destinations"
            placeholder={svc ? 'Where are you going?' : 'Pick a bus first'}
            value={destInput}
            disabled={!svc}
            onInput={(e) => setDestInput(e.target.value)}
          />
        </label>
      </div>
      <datalist id="side-check-destinations">
        {destinations.map((d) => (
          <option value={stopLabel(stops, d)} />
        ))}
      </datalist>
      {result === 'right' && (
        <p class="side-result right">✓ You're on the right side</p>
      )}
      {result === 'wrong' && (
        <p class="side-result wrong">
          ✕ Wrong side
          {opposite ? (
            <>
              {' '}— cross to{' '}
              <a href={`#${opposite.code}`}>
                {stopName(stops, opposite.code)} ({opposite.code})
              </a>
              , {Math.round(opposite.meters)} m
            </>
          ) : (
            ' — board on the other side of the road'
          )}
        </p>
      )}
      {result === 'unknown' && (
        <p class="side-result unknown">
          Can't tell — bus {svc} may not stop there.
        </p>
      )}
    </form>
  );
}

export default function OtherSide({ stops, services, oppositeIndex, code }) {
  if (!stops || !services || !oppositeIndex) return null;
  const opposite = oppositeIndex.get(code);
  return (
    <div class="other-side-box">
      <OppositeCard stops={stops} opposite={opposite} />
      <SideCheck
        key={code}
        stops={stops}
        services={services}
        code={code}
        opposite={opposite}
      />
      <a class="os-map-link" href={`../#/stops/${code}`}>
        View on full map
      </a>
    </div>
  );
}
