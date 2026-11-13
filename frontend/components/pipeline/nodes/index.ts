import ImageNode from "./node/image";
import TextNode from "./node/text";
import VideoNode from "./node/video";
import AudioNode from "./node/audio";
import TimelineNode from "./node/timeline";
import SubjectNode from "./node/subject";
import StageNode from "./node/stage";
import ShotTableNode from "./node/shot-table";
import ToolboxNode from "./node/toolbox";

export default {
  textNode: TextNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  audioNode: AudioNode,
  timelineNode: TimelineNode,
  subjectNode: SubjectNode,
  cameraNode: ToolboxNode,
  paletteNode: ToolboxNode,
  styleNode: ToolboxNode,
  movementNode: ToolboxNode,
  stageNode: StageNode,
  shotTableNode: ShotTableNode,
};
