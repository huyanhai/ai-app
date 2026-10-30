"use client";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { TModelDraft } from "@/store/model-store";
import {
  DEFAULT_MODEL_PARAMS,
  getProvider,
  MODEL_CATEGORY_LABEL,
  MODEL_PROVIDERS,
} from "./constants";
import { ChipGroup, Field, INPUT, SecretInput, SwitchRow } from "./fields";
import {
  AudioParams,
  ImageParams,
  TextParams,
  TParamErrors,
  VideoParams,
} from "./model-params";
import { ModelCategory, TModelConfig, TModelParamsMap } from "./types";

const createDraft = (category: ModelCategory): TModelDraft => {
  const provider = MODEL_PROVIDERS.find((item) =>
    item.categories.includes(category),
  )!;
  return {
    category,
    name: "",
    provider: provider.value,
    modelId: "",
    baseURL: provider.baseURL,
    apiKey: "",
    enabled: true,
    description: "",
    params: structuredClone(DEFAULT_MODEL_PARAMS[category]),
  } as TModelDraft;
};

const toDraft = ({
  id: _id,
  createdAt: _createdAt,
  hasApiKey: _hasApiKey,
  isDefault: _isDefault,
  ...rest
}: TModelConfig) => structuredClone({ ...rest, apiKey: "" }) as TModelDraft;

type TErrors = {
  name?: string;
  modelId?: string;
  baseURL?: string;
  params: TParamErrors;
};

const validate = (draft: TModelDraft): TErrors => {
  const errors: TErrors = { params: {} };
  if (!draft.name.trim()) errors.name = "请输入模型名称";
  if (!draft.modelId.trim()) errors.modelId = "请输入模型 ID";
  if (!draft.baseURL.trim()) {
    errors.baseURL = "请输入接口地址";
  } else if (!URL.canParse(draft.baseURL.trim())) {
    errors.baseURL = "接口地址格式不正确";
  }

  const required: Partial<Record<string, string>> = {};
  if (draft.category === ModelCategory.Image) {
    required.resolutions = draft.params.resolutions.length ? "" : "清晰度";
    required.ratios = draft.params.ratios.length ? "" : "比例";
  }
  if (draft.category === ModelCategory.Video) {
    required.modes = draft.params.modes.length ? "" : "生成模式";
    required.resolutions = draft.params.resolutions.length ? "" : "清晰度";
    required.durations = draft.params.durations.length ? "" : "时长";
  }
  if (draft.category === ModelCategory.Audio) {
    required.formats = draft.params.formats.length ? "" : "输出格式";
  }
  for (const [key, label] of Object.entries(required)) {
    if (label) errors.params[key] = `至少选择一个${label}`;
  }
  return errors;
};

const hasError = (errors: TErrors) =>
  !!(errors.name || errors.modelId || errors.baseURL) ||
  Object.keys(errors.params).length > 0;

const ModelForm = ({
  model,
  category,
  onClose,
  onSubmit,
}: {
  model?: TModelConfig | null;
  category: ModelCategory;
  onClose: () => void;
  onSubmit: (draft: TModelDraft) => void;
}) => {
  const [draft, setDraft] = useState<TModelDraft>(() =>
    model ? toDraft(model) : createDraft(category),
  );
  // 首次提交后才实时展示校验结果
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(draft) : { params: {} };

  const patch = (value: Partial<TModelDraft>) =>
    setDraft((prev) => ({ ...prev, ...value }) as TModelDraft);

  const patchParams = <C extends ModelCategory>(
    value: Partial<TModelParamsMap[C]>,
  ) =>
    setDraft(
      (prev) =>
        ({ ...prev, params: { ...prev.params, ...value } }) as TModelDraft,
    );

  // 切换服务商时，若接口地址未手动修改过则同步为新服务商的默认地址
  const changeProvider = (provider: string) => {
    const prevURL = getProvider(draft.provider)?.baseURL ?? "";
    patch({
      provider,
      baseURL:
        !draft.baseURL || draft.baseURL === prevURL
          ? (getProvider(provider)?.baseURL ?? "")
          : draft.baseURL,
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasError(validate(draft))) return;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      modelId: draft.modelId.trim(),
      baseURL: draft.baseURL.trim().replace(/\/+$/, ""),
      apiKey: draft.apiKey.trim(),
      description: draft.description?.trim(),
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const providers = MODEL_PROVIDERS.filter((item) =>
    item.categories.includes(draft.category),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-h-[85vh] w-[min(640px,92vw)] flex-col rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-base font-medium text-white">
            {model ? "编辑" : "添加"}
            {MODEL_CATEGORY_LABEL[draft.category]}模型
          </h2>
          <p className="mt-0.5 text-xs text-white/40">
            配置接口信息与模型能力，保存在当前浏览器本地
          </p>
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-medium tracking-wide text-white/40">
            基础信息
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="显示名称" required error={errors.name}>
              <input
                autoFocus
                value={draft.name}
                placeholder="如 Seedream 5.0 Lite"
                onChange={(e) => patch({ name: e.target.value })}
                className={INPUT}
              />
            </Field>
            <Field
              label="模型 ID"
              required
              error={errors.modelId}
              hint="调用接口时传入的 model 参数"
            >
              <input
                value={draft.modelId}
                placeholder="如 qwen-plus"
                onChange={(e) => patch({ modelId: e.target.value })}
                className={`${INPUT} font-mono`}
              />
            </Field>
          </div>
          <Field label="服务商">
            <ChipGroup
              options={providers}
              value={draft.provider}
              onChange={changeProvider}
            />
          </Field>
          <Field label="接口地址" required error={errors.baseURL}>
            <input
              value={draft.baseURL}
              placeholder="https://api.example.com/v1"
              onChange={(e) => patch({ baseURL: e.target.value })}
              className={`${INPUT} font-mono`}
            />
          </Field>
          <Field
            label="API Key"
            hint={model?.hasApiKey ? "留空表示保留已保存的 Key" : "未填写时模型会标记为待配置，无法被调用"}
          >
            <SecretInput
              value={draft.apiKey}
              placeholder="sk-..."
              onChange={(apiKey) => patch({ apiKey })}
            />
          </Field>
          <Field label="备注">
            <input
              value={draft.description ?? ""}
              placeholder="可选，如用途、计费说明"
              onChange={(e) => patch({ description: e.target.value })}
              className={INPUT}
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-medium tracking-wide text-white/40">
            模型能力
          </h3>
          {draft.category === ModelCategory.Text && (
            <TextParams
              params={draft.params}
              errors={errors.params}
              onChange={patchParams<ModelCategory.Text>}
            />
          )}
          {draft.category === ModelCategory.Image && (
            <ImageParams
              params={draft.params}
              errors={errors.params}
              onChange={patchParams<ModelCategory.Image>}
            />
          )}
          {draft.category === ModelCategory.Video && (
            <VideoParams
              params={draft.params}
              errors={errors.params}
              onChange={patchParams<ModelCategory.Video>}
            />
          )}
          {draft.category === ModelCategory.Audio && (
            <AudioParams
              params={draft.params}
              errors={errors.params}
              onChange={patchParams<ModelCategory.Audio>}
            />
          )}
          <SwitchRow
            label="启用"
            hint="停用后不会出现在画布的模型选项中"
            checked={draft.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-lg px-4 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          取消
        </button>
        <button
          type="submit"
          className="h-9 rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-white/90 transition-colors cursor-pointer"
        >
          保存
        </button>
      </div>
    </form>
  );
};

// 新建 / 编辑模型弹窗
const ModelFormModal = ({
  open,
  model,
  category,
  onClose,
  onSubmit,
}: {
  open: boolean;
  model?: TModelConfig | null;
  category: ModelCategory;
  onClose: () => void;
  onSubmit: (draft: TModelDraft) => void;
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ModelForm
            key={model?.id ?? category}
            model={model}
            category={category}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ModelFormModal;
