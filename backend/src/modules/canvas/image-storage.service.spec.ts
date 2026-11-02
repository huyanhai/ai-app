import { ImageStorageService } from './image-storage.service';

const upload = jest.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/demo/canvas/image.png' });
jest.mock('@imagekit/nodejs', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ files: { upload } })),
}));

describe('ImageStorageService', () => {
  it('uploads images, transcodes WebM to MP4 and rejects other content', async () => {
    process.env.UPLOAD_IMAGE_PRIVATE_KEY = 'test-key';
    const service = new ImageStorageService();
    const dataUrl = `data:image/png;base64,${Buffer.from('image').toString('base64')}`;

    await expect(service.upload(dataUrl)).resolves.toBe('https://ik.imagekit.io/demo/canvas/image.png');
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ fileName: expect.stringMatching(/\.png$/) }));
    const videoUrl = `data:video/webm;base64,${Buffer.from('video').toString('base64')}`;
    const transcode = jest.spyOn(service as any, 'transcodeWebm').mockResolvedValue(Buffer.from('mp4').toString('base64'));
    await expect(service.upload(videoUrl)).resolves.toBe('https://ik.imagekit.io/demo/canvas/image.png');
    expect(transcode).toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ fileName: expect.stringMatching(/\.mp4$/) }));
    await expect(service.upload('data:text/plain;base64,aGVsbG8=')).rejects.toThrow('Invalid media data URL');
  });
});
