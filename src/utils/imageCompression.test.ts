import { compressImageForUpload, compressImagesForUpload } from './imageCompression';
import imageCompression from 'browser-image-compression';

jest.mock('browser-image-compression', () => ({ __esModule: true, default: jest.fn() }));

const mockCompress = imageCompression as jest.MockedFunction<typeof imageCompression>;

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

// What browser-image-compression ACTUALLY resolves with at runtime: a Blob whose `.name` is a plain
// expando property (its typings claim File). FormData ignores that expando and sends filename="blob".
function makeLibraryResult(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  Object.defineProperty(blob, 'name', { value: name, writable: false });
  return blob as unknown as File;
}

describe('compressImageForUpload', () => {
  beforeEach(() => mockCompress.mockReset());

  it('passes through a non-image file untouched', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 100);

    expect(await compressImageForUpload(file)).toBe(file);
    expect(mockCompress).not.toHaveBeenCalled();
  });

  it('passes through GIF and SVG untouched', async () => {
    const gif = makeFile('anim.gif', 'image/gif', 100);
    const svg = makeFile('logo.svg', 'image/svg+xml', 100);

    expect(await compressImageForUpload(gif)).toBe(gif);
    expect(await compressImageForUpload(svg)).toBe(svg);
    expect(mockCompress).not.toHaveBeenCalled();
  });

  it('returns the compressed bytes when they are smaller', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeLibraryResult('photo.jpg', 'image/jpeg', 300));

    const result = await compressImageForUpload(original);

    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(result).not.toBe(original);
    expect(result.size).toBe(300);
  });

  // REGRESSION (Track F/F1a): the library resolves with a Blob, so appending the raw result sent
  // filename="blob" and the backend's extension allowlist rejected every compressed photo.
  it('returns a real File carrying the original filename, even though the library returns a Blob', async () => {
    const original = makeFile('Ali Nazik.JPG', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeLibraryResult('blob', 'image/jpeg', 300));

    const result = await compressImageForUpload(original);

    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('Ali Nazik.JPG');
    expect(result.name.length).toBeGreaterThan(0);
    expect(result.type).toBe('image/jpeg');
  });

  it('falls back to the original file type when the compressed result has none', async () => {
    const original = makeFile('photo.webp', 'image/webp', 1000);
    mockCompress.mockResolvedValue(makeLibraryResult('blob', '', 300));

    const result = await compressImageForUpload(original);

    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('photo.webp');
  });

  it('keeps the original when compression does not shrink it', async () => {
    const original = makeFile('tiny.jpg', 'image/jpeg', 200);
    mockCompress.mockResolvedValue(makeLibraryResult('blob', 'image/jpeg', 500));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('fails open to the original when compression throws', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockRejectedValue(new Error('canvas unavailable'));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('keeps the original when the compressed result is empty/truncated', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeLibraryResult('blob', 'image/jpeg', 0));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('passes the backend-matching options (1600px, main-thread)', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeLibraryResult('blob', 'image/jpeg', 300));

    await compressImageForUpload(original);

    expect(mockCompress).toHaveBeenCalledWith(
      original,
      expect.objectContaining({ maxWidthOrHeight: 1600, useWebWorker: false }),
    );
  });
});

describe('compressImagesForUpload', () => {
  beforeEach(() => mockCompress.mockReset());

  it('compresses each file, falling back per-file on failure', async () => {
    const a = makeFile('a.jpg', 'image/jpeg', 1000);
    const b = makeFile('b.jpg', 'image/jpeg', 1000);
    mockCompress
      .mockResolvedValueOnce(makeLibraryResult('blob', 'image/jpeg', 300))
      .mockRejectedValueOnce(new Error('boom'));

    const [ra, rb] = await compressImagesForUpload([a, b]);

    // Every file in a bulk upload keeps its own name — that is what the backend allowlists on.
    expect(ra).toBeInstanceOf(File);
    expect(ra.name).toBe('a.jpg');
    expect(ra.size).toBe(300);
    expect(rb).toBe(b);
  });
});
