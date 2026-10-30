"use client";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { TModelDraft, useModelStore } from "@/store/model-store";
import ModelCard from "@/components/models/model-card";
import ModelFormModal from "@/components/models/model-form-modal";
import { MODEL_CATEGORIES } from "@/components/models/constants";
import { ModelCategory, TModelConfig } from "@/components/models/types";

const Page = () => {
  const [hydrated, setHydrated] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  // 新建时所属类别；编辑时以被编辑模型的类别为准
  const [category, setCategory] = useState(ModelCategory.Text);
  const [editing, setEditing] = useState<TModelConfig | null>(null);

  const models = useModelStore((s) => s.models);
  const defaults = useModelStore((s) => s.defaults);
  const addModel = useModelStore((s) => s.addModel);
  const updateModel = useModelStore((s) => s.updateModel);
  const removeModel = useModelStore((s) => s.removeModel);
  const toggleModel = useModelStore((s) => s.toggleModel);
  const setDefault = useModelStore((s) => s.setDefault);

  // 从后端 SQLite 加载配置；首次加载会迁移旧 localStorage 数据
  useEffect(() => {
    void useModelStore.getState().loadModels().finally(() => setHydrated(true));
  }, []);

  const query = keyword.trim().toLowerCase();
  const matched = models.filter(
    (model) =>
      !query ||
      [model.name, model.modelId, model.provider].some((v) =>
        v.toLowerCase().includes(query),
      ),
  );

  const openCreate = (value: ModelCategory) => {
    setEditing(null);
    setCategory(value);
    setModalOpen(true);
  };

  const openEdit = (model: TModelConfig) => {
    setEditing(model);
    setCategory(model.category);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const submit = async (draft: TModelDraft) => {
    if (editing) {
      await updateModel(editing.id, draft);
    } else {
      await addModel(draft);
    }
    setModalOpen(false);
  };

  return (
    <>
      <header className="flex items-end justify-between gap-4 border-b border-white/5 px-8 py-5">
        <div>
          <h2 className="text-base font-medium">模型配置</h2>
          <p className="mt-1 text-xs text-white/40">
            管理文本、图片、视频、音频生成使用的模型
          </p>
        </div>
        <div className="flex h-9 w-60 items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 text-white/40 focus-within:border-[#33a3ff]/60">
          <Search size={14} />
          <input
            value={keyword}
            placeholder="搜索名称 / 模型 ID / 服务商"
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {hydrated && (
          <div className="flex flex-col gap-10">
            {MODEL_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const list = matched.filter(
                (model) => model.category === item.value,
              );
              return (
                <section key={item.value} id={item.value}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
                        <Icon size={15} />
                      </div>
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-medium">
                          {item.label}模型
                          <span className="text-xs font-normal text-white/30">
                            {list.length}
                          </span>
                        </h3>
                        <p className="text-xs text-white/40">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openCreate(item.value)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs text-white hover:bg-white/15 transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      添加{item.label}模型
                    </button>
                  </div>

                  {list.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                      {list.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isDefault={defaults[item.value] === model.id}
                          onEdit={() => openEdit(model)}
                          onRemove={() => removeModel(model.id)}
                          onToggle={() => toggleModel(model.id)}
                          onSetDefault={() => setDefault(item.value, model.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-white/30">
                      {query
                        ? "没有匹配的模型"
                        : `还没有${item.label}模型，点击右上角添加`}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <ModelFormModal
        open={modalOpen}
        model={editing}
        category={category}
        onClose={closeModal}
        onSubmit={submit}
      />
    </>
  );
};

export default Page;
