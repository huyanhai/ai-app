"use client";
import {
  AUDIO_FORMATS,
  AUDIO_SAMPLE_RATES,
  IMAGE_RESOLUTIONS,
  MODEL_RATIOS,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_RESOLUTIONS,
} from "./constants";
import {
  ChipGroup,
  Field,
  INPUT,
  NumberInput,
  Slider,
  SwitchRow,
} from "./fields";
import {
  TAudioModelParams,
  TImageModelParams,
  TTextModelParams,
  TVideoModelParams,
} from "./types";

const toOptions = <T extends string | number>(list: T[], suffix = "") =>
  list.map((value) => ({ value, label: `${value}${suffix}` }));

export type TParamErrors = Partial<Record<string, string>>;

type TParamsProps<P> = {
  params: P;
  errors: TParamErrors;
  onChange: (patch: Partial<P>) => void;
};

export const TextParams = ({
  params,
  onChange,
}: TParamsProps<TTextModelParams>) => (
  <>
    <Field label="温度" hint="越高输出越发散，越低越稳定">
      <Slider
        value={params.temperature}
        min={0}
        max={2}
        step={0.1}
        onChange={(temperature) => onChange({ temperature })}
      />
    </Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="最大输出">
        <NumberInput
          value={params.maxTokens}
          min={1}
          max={1_000_000}
          suffix="tokens"
          onChange={(maxTokens) => onChange({ maxTokens })}
        />
      </Field>
      <Field label="上下文长度">
        <NumberInput
          value={params.contextWindow}
          min={1}
          max={10_000}
          suffix="K"
          onChange={(contextWindow) => onChange({ contextWindow })}
        />
      </Field>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <SwitchRow
        label="工具调用"
        hint="支持 Function Calling"
        checked={params.supportTools}
        onChange={(supportTools) => onChange({ supportTools })}
      />
      <SwitchRow
        label="图片理解"
        hint="可输入图片作为参考"
        checked={params.supportVision}
        onChange={(supportVision) => onChange({ supportVision })}
      />
    </div>
  </>
);

export const ImageParams = ({
  params,
  errors,
  onChange,
}: TParamsProps<TImageModelParams>) => (
  <>
    <Field label="支持清晰度" required error={errors.resolutions}>
      <ChipGroup
        multiple
        options={toOptions(IMAGE_RESOLUTIONS)}
        value={params.resolutions}
        onChange={(resolutions) => onChange({ resolutions })}
      />
    </Field>
    <Field label="支持比例" required error={errors.ratios}>
      <ChipGroup
        multiple
        options={toOptions(MODEL_RATIOS)}
        value={params.ratios}
        onChange={(ratios) => onChange({ ratios })}
      />
    </Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="单次最多生成">
        <NumberInput
          value={params.maxCount}
          min={1}
          max={16}
          suffix="张"
          onChange={(maxCount) => onChange({ maxCount })}
        />
      </Field>
      <Field label="参考图">
        <SwitchRow
          label="支持参考图"
          checked={params.supportReference}
          onChange={(supportReference) => onChange({ supportReference })}
        />
      </Field>
    </div>
  </>
);

export const VideoParams = ({
  params,
  errors,
  onChange,
}: TParamsProps<TVideoModelParams>) => (
  <>
    <Field label="生成模式" required error={errors.modes}>
      <ChipGroup
        multiple
        options={VIDEO_MODES}
        value={params.modes}
        onChange={(modes) => onChange({ modes })}
      />
    </Field>
    <Field label="支持清晰度" required error={errors.resolutions}>
      <ChipGroup
        multiple
        options={toOptions(VIDEO_RESOLUTIONS)}
        value={params.resolutions}
        onChange={(resolutions) => onChange({ resolutions })}
      />
    </Field>
    <Field label="支持时长" required error={errors.durations}>
      <ChipGroup
        multiple
        options={toOptions(VIDEO_DURATIONS, "s")}
        value={params.durations}
        onChange={(durations) => onChange({ durations })}
      />
    </Field>
  </>
);

export const AudioParams = ({
  params,
  errors,
  onChange,
}: TParamsProps<TAudioModelParams>) => (
  <>
    <Field label="输出格式" required error={errors.formats}>
      <ChipGroup
        multiple
        options={toOptions(AUDIO_FORMATS)}
        value={params.formats}
        onChange={(formats) => onChange({ formats })}
      />
    </Field>
    <Field label="采样率">
      <ChipGroup
        options={toOptions(AUDIO_SAMPLE_RATES, " Hz")}
        value={params.sampleRate}
        onChange={(sampleRate) => onChange({ sampleRate })}
      />
    </Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="默认音色" hint="服务商提供的音色 ID，可留空">
        <input
          value={params.voice}
          placeholder="音色 ID"
          onChange={(e) => onChange({ voice: e.target.value })}
          className={`${INPUT} font-mono`}
        />
      </Field>
      <Field label="音色克隆">
        <SwitchRow
          label="支持音色克隆"
          checked={params.supportClone}
          onChange={(supportClone) => onChange({ supportClone })}
        />
      </Field>
    </div>
  </>
);
