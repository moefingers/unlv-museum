# Globe

## How it works

The landing page renders a 3D sphere of project cards using CSS `preserve-3d` transforms.

### Card positioning

Each card is placed on the sphere surface using the Fibonacci sphere algorithm for even distribution:

```
rotateY(longitude) rotateX(-latitude) translateZ(radius)
```

Start at center, rotate to the correct angle, push outward. This is the correct mental model — never compute cartesian coordinates and use `translate3d`.

### preserve-3d chain

The `transformStyle: preserve-3d` property must be set on **every** element in the chain from the perspective root to any element using `translateZ`. One missing link flattens the entire subtree. Current chain:

```
Outer (perspective: 1200px, overflow: hidden)
  Tilt wrapper (preserve-3d, rotateZ -18deg)
    Rotation inner (preserve-3d, rotateX/rotateY)
      Item wrapper (preserve-3d, rotateY/rotateX/translateZ)
        Centering div (preserve-3d, translate -88px -36px)
          Card (preserve-3d)
            Depth layers (translateZ -1.5px to -7.5px)
```

### Card depth

Stacked layers behind the front face, each slightly larger (negative inset grows outward). Creates a 3D extrusion effect visible from oblique angles. Front face has a category gradient; back layers have the full category color gradient.

### Momentum physics

iOS-style exponential velocity decay:

- Drag velocity tracked via exponential moving average (0.8 new / 0.2 old)
- On release: position-based targeting with `target - amplitude * e^(-t/τ)`, τ = 600ms
- Vertical bounces off ±60° poles (reflection, not clamping)
- Auto-rotation (0.08 deg/frame) resumes when momentum dies
- Stationary finger guard: if last move was >50ms ago, velocity zeroes out

### Tilt

18° axial tilt via a separate wrapper div. Must NOT be in the rotation transform — that would change the axes the drag operates on.

### Card centering

Fixed pixel offset (`translate(-88px, -36px)`) instead of percentage-based `-translate-x-1/2`. The depth layers with negative insets expand the element's computed size, making percentage-based centering inaccurate.
