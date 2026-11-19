import CheapRuler from 'cheap-ruler';

const ruler = new CheapRuler(1.3, 'meters');

// Pairing rule (see ../../../PLAN.md): an opposite stop must be on the *other*
// direction of a service that serves this stop, within MAX_METERS, and share
// the first 4 digits of its stop code (LTA convention, e.g. 44299 <-> 44291).
const MAX_METERS = 80;

/**
 * Precompute the opposite stop for every stop that has a confident match.
 *
 * @param {Record<string, [number, number, string, string]>} stops  code -> [lng, lat, name, road]
 * @param {Record<string, {name: string, routes: string[][]}>} services  svc -> { routes: [dir1, dir2?] }
 * @returns {Map<string, {code: string, meters: number}>}
 */
export function buildOppositeIndex(stops, services) {
  const index = new Map();
  for (const { routes } of Object.values(services)) {
    if (routes.length !== 2) continue; // loops and one-way services have no opposite route
    const [r1, r2] = routes;
    for (const [here, there] of [
      [r1, r2],
      [r2, r1],
    ]) {
      for (const a of here) {
        const A = stops[a];
        if (!A) continue;
        for (const b of there) {
          if (b === a || b.slice(0, 4) !== a.slice(0, 4)) continue;
          const B = stops[b];
          if (!B) continue;
          const meters = ruler.distance(A, B);
          if (meters > MAX_METERS) continue;
          const best = index.get(a);
          if (!best || meters < best.meters) index.set(a, { code: b, meters });
        }
      }
    }
  }
  return index;
}

/**
 * Services (from services.min.json) that stop at `code`, sorted naturally.
 * @returns {string[]}
 */
export function servicesAtStop(services, code) {
  return Object.keys(services)
    .filter((svc) => services[svc].routes.some((r) => r.includes(code)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Is `here` the right stop to board `routes`' service if I want to reach `destination`?
 *
 * @param {string[][]} routes  the service's directions: [dir1] or [dir1, dir2],
 *                             each an ordered list of stop codes
 * @param {string} here        the stop I'm standing at
 * @param {string} destination the stop I want to get off at
 * @returns {'right' | 'wrong' | 'unknown'}
 *   'right'   – some direction visits `here` and later visits `destination`
 *   'wrong'   – the service reaches `destination`, but not after `here`
 *               (I should board on the other side)
 *   'unknown' – the service doesn't serve one of the two stops
 */
export function isRightSide(routes, here, destination) {
  // TODO(you): implement the ordering check (5–10 lines).
  // Watch out: at a terminus or on a loop, `here` can appear in BOTH directions,
  // and on a loop a stop can even appear twice in the same direction.
  return 'unknown';
}
