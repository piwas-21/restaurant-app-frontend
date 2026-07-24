/**
 * Shared scene defs — floor textures, the booked-table hatch and the craft
 * "rough" ink filter. Patterns paint in the skin's tokens (`var(--fp-*)`), so
 * one set of defs serves both skins; the rough filter is referenced only by the
 * craft skin (via `--fp-rough`), harmless when unused. Ported from the
 * prototype's `defs()` / `FLOORS`.
 */

const WOOD_PLANKS: ReadonlyArray<readonly [number, number]> = [
  [70, 0],
  [210, 40],
  [110, 80],
  [260, 120],
  [40, 160],
  [180, 200],
  [90, 240],
  [240, 280],
];

function FloorLine({ x1, y1, x2, y2 }: Readonly<{ x1: number; y1: number; x2: number; y2: number }>) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fp-faint)" strokeWidth={1} />;
}

function WoodPattern() {
  return (
    <pattern id="fp-floor-wood" width={320} height={320} patternUnits="userSpaceOnUse">
      <rect width={320} height={320} fill="var(--fp-floor)" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
        <FloorLine key={`h${r}`} x1={0} y1={r * 40} x2={320} y2={r * 40} />
      ))}
      {WOOD_PLANKS.map(([x, y]) => (
        <FloorLine key={`p${x}-${y}`} x1={x} y1={y} x2={x} y2={y + 40} />
      ))}
    </pattern>
  );
}

function DeckPattern() {
  return (
    <pattern id="fp-floor-deck" width={320} height={320} patternUnits="userSpaceOnUse">
      <rect width={320} height={320} fill="var(--fp-floor)" />
      {[1, 2, 3, 4, 5, 6].flatMap((r) => [
        <FloorLine key={`d${r}a`} x1={0} y1={r * 50} x2={320} y2={r * 50} />,
        <FloorLine key={`d${r}b`} x1={0} y1={r * 50 + 6} x2={320} y2={r * 50 + 6} />,
      ])}
    </pattern>
  );
}

function TilePattern() {
  return (
    <pattern id="fp-floor-tile" width={320} height={320} patternUnits="userSpaceOnUse">
      <rect width={320} height={320} fill="var(--fp-floor)" />
      {[1, 2, 3, 4].flatMap((i) => [
        <FloorLine key={`t${i}v`} x1={i * 64} y1={0} x2={i * 64} y2={320} />,
        <FloorLine key={`t${i}h`} x1={0} y1={i * 64} x2={320} y2={i * 64} />,
      ])}
    </pattern>
  );
}

export default function SceneDefs() {
  return (
    <defs>
      <WoodPattern />
      <DeckPattern />
      <TilePattern />
      <pattern id="fp-hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={10} stroke="var(--fp-scenery)" strokeWidth={3} opacity={0.4} />
      </pattern>
      <filter id="fp-rough" x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={3} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  );
}
