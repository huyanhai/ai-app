import { createCanvasTools } from './canvas-tools';

const invoke = jest.fn().mockResolvedValue({ content: '图片里是一只白熊。' });

jest.mock('@/common/llm', () => ({
  createChatModel: () => ({ invoke }),
}));

describe('canvas tools', () => {
  beforeEach(() => invoke.mockClear());

  const setup = () => {
    const canvas = {
      getState: jest
        .fn()
        .mockResolvedValue({
          revision: 1,
          nodes: [
            {
              id: 'image-1',
              type: 'imageNode',
              data: { url: 'https://img.example/bear.png' },
            },
          ],
        }),
      applyOps: jest.fn().mockResolvedValue({ success: true, revision: 2 }),
      arrange: jest.fn().mockResolvedValue({ success: true, revision: 3 }),
      deleteNodes: jest.fn().mockResolvedValue({ success: true, revision: 4 }),
    };
    const images = {
      extractLastFrame: jest
        .fn()
        .mockResolvedValue('https://img.example/frame.jpg'),
    };
    const tools = createCanvasTools({} as any, canvas as any, images as any, {
      canvasId: 'canvas-1',
      runId: 'run-1',
      revision: 1,
    });
    return { canvas, images, tools };
  };

  it('registers canvas operations bound to the current run', async () => {
    const { canvas, tools } = setup();
    expect(tools.map((tool) => tool.name)).toEqual([
      'canvas_get_state',
      'canvas_apply_ops',
      'canvas_arrange',
      'canvas_delete',
      'canvas_inspect_image',
      'canvas_inspect_video',
      'canvas_capture_frame',
    ]);

    await tools[0].invoke({ nodeIds: ['image-1'] });
    await tools[1].invoke({
      operations: [{ action: 'delete_node', id: 'old' }],
    });
    await tools[2].invoke({ mode: 'grid', nodeIds: ['image-1'] });
    await tools[3].invoke({ nodeIds: ['old'] });

    expect(canvas.getState).toHaveBeenCalledWith('canvas-1', ['image-1']);
    expect(canvas.applyOps).toHaveBeenCalledWith(
      'canvas-1',
      'run-1',
      [{ action: 'delete_node', id: 'old' }],
      1,
    );
    expect(canvas.arrange).toHaveBeenCalledWith(
      'canvas-1',
      'run-1',
      { mode: 'grid', nodeIds: ['image-1'] },
      1,
    );
    expect(canvas.deleteNodes).toHaveBeenCalledWith(
      'canvas-1',
      'run-1',
      ['old'],
      1,
    );
  });

  it('inspects canvas images and explicitly limits video analysis to a frame', async () => {
    const { canvas, images, tools } = setup();
    await expect(
      tools[4].invoke({ nodeId: 'image-1', question: '描述角色' }),
    ).resolves.toEqual({
      description: '图片里是一只白熊。',
      nodeId: 'image-1',
    });
    expect(invoke).toHaveBeenCalledTimes(1);

    canvas.getState.mockResolvedValue({
      nodes: [
        {
          id: 'video-1',
          type: 'videoNode',
          data: { url: 'https://video.example/bear.mp4' },
        },
      ],
    });
    await expect(
      tools[5].invoke({ nodeId: 'video-1', question: '描述结尾' }),
    ).resolves.toEqual({
      description: '图片里是一只白熊。',
      nodeId: 'video-1',
      frame: 'last',
      audioAnalyzed: false,
    });
    expect(images.extractLastFrame).toHaveBeenCalledWith(
      'https://video.example/bear.mp4',
    );
    await expect(tools[6].invoke({ nodeId: 'video-1' })).resolves.toEqual({
      nodeId: 'video-1',
      url: 'https://img.example/frame.jpg',
      frame: 'last',
    });
  });
});
