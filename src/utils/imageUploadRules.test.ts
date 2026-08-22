import {
  ACCEPTED_IMAGE_TYPES_ATTR,
  MAX_IMAGE_BYTES,
  imageRejectionMessage,
  partitionAcceptableImages,
} from './imageUploadRules';

const file = (name: string, type: string, size: number): File => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

// `t` echoes the key plus the interpolation, so the assertions can see WHICH file was named —
// the whole value of the message is that it says what to fix.
const t = ((key: string, opts?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(opts ?? {})}`) as unknown as Parameters<typeof imageRejectionMessage>[0];

describe('imageUploadRules — the client half of the server allowlist', () => {
  // If these three drift from backend appsettings.json, the picker offers files the server
  // refuses and the tenant is back to "the photo does not upload".
  it('mirrors the backend allowlist and size cap', () => {
    expect(ACCEPTED_IMAGE_TYPES_ATTR).toBe('image/jpeg,image/png,image/webp');
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('accepts the three stored formats', () => {
    const files = [
      file('a.jpg', 'image/jpeg', 1000),
      file('b.png', 'image/png', 1000),
      file('c.webp', 'image/webp', 1000),
    ];

    const selection = partitionAcceptableImages(files);

    expect(selection.accepted).toHaveLength(3);
    expect(selection.oversized).toHaveLength(0);
    expect(selection.wrongType).toHaveLength(0);
    expect(imageRejectionMessage(t, selection)).toBeNull();
  });

  // HEIC is what an iPhone writes by default and ImageSharp 3.1.12 cannot decode it. `accept`
  // stops the dialog offering it; this stops a drag-and-drop or an "All files" pick.
  it('refuses a HEIC and a GIF whatever the dialog allowed through', () => {
    const selection = partitionAcceptableImages([
      file('camera.heic', 'image/heic', 1000),
      file('loop.gif', 'image/gif', 1000),
      file('good.jpg', 'image/jpeg', 1000),
    ]);

    expect(selection.wrongType.map((f) => f.name)).toEqual(['camera.heic', 'loop.gif']);
    expect(selection.accepted.map((f) => f.name)).toEqual(['good.jpg']);
    expect(imageRejectionMessage(t, selection)).toContain('camera.heic, loop.gif');
  });

  it('refuses a file over the cap and names it, keeping one exactly at the cap', () => {
    const selection = partitionAcceptableImages([
      file('huge.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1),
      file('exact.jpg', 'image/jpeg', MAX_IMAGE_BYTES),
    ]);

    expect(selection.oversized.map((f) => f.name)).toEqual(['huge.jpg']);
    expect(selection.accepted.map((f) => f.name)).toEqual(['exact.jpg']);
    const message = imageRejectionMessage(t, selection);
    expect(message).toContain('images_too_large');
    expect(message).toContain('huge.jpg');
    // The limit is quoted in the reader's own units, not as a byte count. Matched as a pattern
    // because the decimal separator is the RUNNER's locale (CLAUDE.md §5.15) — `10,0 MB` here.
    expect(message).toMatch(/10[.,]0 MB/);
  });

  it('says both things when a pick is wrong in both ways', () => {
    const selection = partitionAcceptableImages([
      file('huge.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1),
      file('camera.heic', 'image/heic', 10),
    ]);

    const message = imageRejectionMessage(t, selection) ?? '';
    expect(message).toContain('images_too_large');
    expect(message).toContain('images_wrong_type');
  });
});
