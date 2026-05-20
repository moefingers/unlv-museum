/**
 * Tiny damped-harmonic-oscillator spring primitive.
 *
 * Usage:
 *   const s = makeSpring({ stiffness: 250, damping: 18 });
 *   s.position = 0;
 *   s.velocity = 0;
 *   s.target = 1;
 *   // ... per frame ...
 *   stepSpring(s, dtSeconds);
 *   // s.position now contains the next value, approaching s.target with overshoot
 *
 * Math:
 *   acceleration = stiffness * (target - position) - damping * velocity
 *   velocity     += acceleration * dt
 *   position     += velocity * dt
 *
 * Critical-damping condition is at damping = 2 * sqrt(stiffness).
 * For stiffness=250, critical damping is ~31.6. Anything below that
 * produces visible overshoot (the "bounce" effect). damping=18 is a
 * lively-but-controlled bounce; damping=12 is springier; damping=24
 * starts to feel sluggish.
 *
 * The integration is semi-implicit Euler — adequate for animation
 * timescales (dt ≈ 16ms). Larger dt accumulates error but recovers as
 * the spring settles. We clamp dt to avoid stiff-equation instability
 * when a tab is backgrounded and resumed.
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface Spring {
  position: number;
  velocity: number;
  target: number;
  config: SpringConfig;
}

export function makeSpring(config: SpringConfig, initial = 0): Spring {
  return {
    position: initial,
    velocity: 0,
    target: initial,
    config,
  };
}

/**
 * Advance a spring by `dt` seconds. Mutates `s` in place. Returns the
 * new position for convenience.
 *
 * dt is clamped to a maximum step (~50ms) to keep the integrator
 * stable when the page wakes from a backgrounded tab and we get a
 * single huge dt.
 */
export function stepSpring(s: Spring, dt: number): number {
  const dtClamped = Math.min(dt, 0.05);
  const acc =
    s.config.stiffness * (s.target - s.position) -
    s.config.damping * s.velocity;
  s.velocity += acc * dtClamped;
  s.position += s.velocity * dtClamped;
  return s.position;
}

/**
 * A spring is "settled" when both its position is close to target AND
 * its velocity is small. Useful for stopping rAF loops once nothing's
 * moving.
 */
export function isSpringSettled(
  s: Spring,
  positionEpsilon = 0.001,
  velocityEpsilon = 0.001,
): boolean {
  return (
    Math.abs(s.position - s.target) < positionEpsilon &&
    Math.abs(s.velocity) < velocityEpsilon
  );
}
