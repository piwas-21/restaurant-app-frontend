import { compressImageForUpload, compressImagesForUpload } from './imageCompression';
import imageCompression from 'browser-image-compression';

jest.mock('browser-image-compression', () => ({ __esModule: true, default: jest.fn() }));

const mockCompress = imageCompression as jest.MockedFunction<typeof imageCompression>;

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
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

  it('returns the compressed file when it is smaller', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    const smaller = makeFile('photo.jpg', 'image/jpeg', 300);
    mockCompress.mockResolvedValue(smaller);

    const result = await compressImageForUpload(original);

    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(result).toBe(smaller);
  });

  it('keeps the original when compression does not shrink it', async () => {
    const original = makeFile('tiny.jpg', 'image/jpeg', 200);
    mockCompress.mockResolvedValue(makeFile('tiny.jpg', 'image/jpeg', 500));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('fails open to the original when compression throws', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockRejectedValue(new Error('canvas unavailable'));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('keeps the original when the compressed result is empty/truncated', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeFile('photo.jpg', 'image/jpeg', 0));

    expect(await compressImageForUpload(original)).toBe(original);
  });

  it('passes the backend-matching options (1600px, main-thread)', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 1000);
    mockCompress.mockResolvedValue(makeFile('photo.jpg', 'image/jpeg', 300));

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
    const aSmall = makeFile('a.jpg', 'image/jpeg', 300);
    mockCompress.mockResolvedValueOnce(aSmall).mockRejectedValueOnce(new Error('boom'));

    const [ra, rb] = await compressImagesForUpload([a, b]);

    expect(ra).toBe(aSmall);
    expect(rb).toBe(b);
  });
});
