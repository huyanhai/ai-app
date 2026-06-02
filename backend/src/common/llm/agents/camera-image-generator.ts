import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { CameraSchema, type Camera, type ShotDescription, type ShotBriefDescription } from '../models';

// ============================================================
// CameraImageGenerator — 摄影机/镜头树构建器
// 职责：构建多机位拍摄的层级结构，确定各机位的父子覆盖关系。
// 父机位视角更广、内容覆盖子机位，用于指导多角度同时拍摄。
// ============================================================

// ── Prompts ──

const SYSTEM_SELECT_PARENT_CAMERA = `[Role]
You are a professional video editing expert specializing in multi-camera shot analysis. You have deep knowledge of cinematic language, enabling you to understand shot sizes (e.g., wide shot, medium shot, close-up) and content inclusion relationships.

[Task]
Your task is to analyze the input camera position data to construct a "camera position tree". This tree structure represents a relationship where a parent camera's content encompasses that of a child camera.

[Input]
The input is a sequence of cameras. The sequence will be enclosed within <CAMERA_SEQ> and </CAMERA_SEQ>.
Each camera contains a sequence of shots filmed by the camera, which will be enclosed within <CAMERA_N> and </CAMERA_N>, where N is the index of the camera.

[Output]
{format_instructions}

[Guidelines]
- Content Inclusion Check: The parent camera should as fully as possible contain the child camera's content.
- Transition Smoothness Priority: Larger shot size as parent camera is preferred.
- Temporal Proximity: The shot index of the parent camera should be as close as possible to the first shot index of the child camera.
- Logical Consistency: The camera tree should be acyclic.
- Only one camera can exist without a parent.
- The first camera must be the root of the camera tree.`;

const HUMAN_SELECT_PARENT_CAMERA = `<CAMERA_SEQ>
{camera_seq}
</CAMERA_SEQ>`;

// ── Schemas ──

const CameraParentItemSchema = z.object({
  parent_cam_idx: z.number().nullable().describe('The index of the parent camera. Set to null if no parent.'),
  parent_shot_idx: z.number().nullable().describe('The index of the dependent shot. Set to null if no parent.'),
  reason: z.string().describe('The reason for the selection of the parent camera.'),
  is_parent_fully_covers_child: z.boolean().nullable().describe('Whether the parent camera fully covers the child.'),
  missing_info: z.string().nullable().describe('Missing elements in the child shot not covered by the parent.'),
});

const CameraTreeSchema = z.object({
  camera_parent_items: z
    .array(CameraParentItemSchema.nullable())
    .describe('The parent camera items for each camera.'),
});

// ── Agent ──

export class CameraImageGenerator {
  constructor(private model: ChatOpenAI) {}

  /**
   * 构建摄影机层级树。
   * 原则：父机位内容覆盖子机位；镜头越大越适合做父节点；
   * 第一台摄影机必须为树根。
   */
  async constructCameraTree(
    cameras: Camera[],
    shotDescs: (ShotDescription | ShotBriefDescription)[],
  ): Promise<Camera[]> {
    const formatInstructions =
      'Return a JSON object with a key "camera_parent_items" whose value is an array of objects (or null), each with keys: parent_cam_idx (number|null), parent_shot_idx (number|null), reason (string), is_parent_fully_covers_child (boolean|null), missing_info (string|null).';

    let cameraSeq = '<CAMERA_SEQ>\n';
    for (const cam of cameras) {
      cameraSeq += `<CAMERA_${cam.idx}>\n`;
      for (const shotIdx of cam.active_shot_idxs) {
        cameraSeq += `Shot ${shotIdx}: ${shotDescs[shotIdx].visual_desc}\n`;
      }
      cameraSeq += `</CAMERA_${cam.idx}>\n`;
    }
    cameraSeq += '</CAMERA_SEQ>';

    const messages: BaseMessage[] = [
      new SystemMessage(
        SYSTEM_SELECT_PARENT_CAMERA.replace('{format_instructions}', formatInstructions),
      ),
      new HumanMessage(HUMAN_SELECT_PARENT_CAMERA.replace('{camera_seq}', cameraSeq)),
    ];

    const modelWithStructure = this.model.withStructuredOutput(CameraTreeSchema, {
      method: 'jsonMode',
    });

    const response = await modelWithStructure.invoke(messages);

    for (let i = 0; i < cameras.length; i++) {
      const item = response.camera_parent_items[i];
      if (item) {
        cameras[i].parent_cam_idx = item.parent_cam_idx;
        cameras[i].parent_shot_idx = item.parent_shot_idx;
        cameras[i].reason = item.reason;
        cameras[i].is_parent_fully_covers_child = item.is_parent_fully_covers_child;
        cameras[i].missing_info = item.missing_info;
      }
    }

    return cameras;
  }

  /** 生成两个镜头之间的转场 Prompt，用于连贯的图像生成 */
  generateTransitionPrompt(
    firstShotVisualDesc: string,
    secondShotVisualDesc: string,
  ): string {
    return [
      `Two shots. The transition between the shots is a cut to. The style of the two shots should be consistent.`,
      `The first shot description: ${firstShotVisualDesc}.`,
      `The second shot description: ${secondShotVisualDesc}.`,
    ].join('\n');
  }
}
