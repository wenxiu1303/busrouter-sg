import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';

import { servicesAtStop, isRightSide } from '../utils/otherSide';

const stopLabel = (stops, code) => `${stops[code]?.[2] || code} (${code})`;

function OppositeLink({ stops, opposite }) {
  if (!opposite) return null;
  return (
    <p class="other-side">
      Other side:{' '}
      <a href={`#${opposite.code}`}>{stopLabel(stops, opposite.code)}</a>{' '}
      · {Math.round(opposite.meters)} m
    </p>
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
      <label>
        Bus{' '}
        <select value={svc} onInput={(e) => setSvc(e.target.value)}>
          <option value="">–</option>
          {options.map((s) => (
            <option value={s}>{s}</option>
          ))}
        </select>
      </label>{' '}
      <label>
        to{' '}
        <input
          list="side-check-destinations"
          placeholder="Destination stop"
          value={destInput}
          disabled={!svc}
          onInput={(e) => setDestInput(e.target.value)}
        />
      </label>
      <datalist id="side-check-destinations">
        {destinations.map((d) => (
          <option value={stopLabel(stops, d)} />
        ))}
      </datalist>
      {result === 'right' && <p class="side-result right">✅ Right side</p>}
      {result === 'wrong' && (
        <p class="side-result wrong">
          ❌ Wrong side
          {opposite ? (
            <>
              , cross to{' '}
              <a href={`#${opposite.code}`}>{stopLabel(stops, opposite.code)}</a>{' '}
              ({Math.round(opposite.meters)} m)
            </>
          ) : (
            ': board on the other side of the road'
          )}
        </p>
      )}
      {result === 'unknown' && (
        <p class="side-result unknown">
          Can't tell: bus {svc} may not serve that stop.
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
      <p>
        <a href={`../#/stops/${code}`}>Show on map →</a>
      </p>
      <OppositeLink stops={stops} opposite={opposite} />
      <SideCheck
        key={code}
        stops={stops}
        services={services}
        code={code}
        opposite={opposite}
      />
    </div>
  );
}
