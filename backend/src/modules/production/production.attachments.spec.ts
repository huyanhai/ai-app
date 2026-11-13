import { prepareProductionAttachments } from './production.attachments';

const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

describe('prepareProductionAttachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetText.mockResolvedValue({ text: 'PDF 剧本正文' });
    mockDestroy.mockResolvedValue(undefined);
  });

  it('decodes text scripts and preserves images as multimodal input', async () => {
    const result = await prepareProductionAttachments([
      { name: 'script.md', type: 'text/markdown', content: Buffer.from('长颈鹿喝水').toString('base64') },
      { name: 'style.png', type: 'image/png', content: 'aW1hZ2U=' },
    ]);

    expect(result.text).toContain('【附件：script.md】\n长颈鹿喝水');
    expect(result.images).toEqual([{
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    }]);
  });

  it('extracts PDF scripts and releases the parser', async () => {
    const result = await prepareProductionAttachments([
      { name: 'script.pdf', type: 'application/pdf', content: 'cGRm' },
    ]);

    expect(result.text).toContain('PDF 剧本正文');
    expect(mockGetText).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported documents instead of ignoring them', async () => {
    await expect(prepareProductionAttachments([
      { name: 'script.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: 'ZG9jeA==' },
    ])).rejects.toThrow('不支持的文件类型');
  });
});
