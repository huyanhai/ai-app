import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModelConfig } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

export type ModelInput = {
  id?: string;
  category: string;
  name: string;
  provider: string;
  modelId: string;
  baseURL: string;
  apiKey?: string;
  enabled: boolean;
  description?: string;
  params: Record<string, unknown>;
};

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  private present(model: ModelConfig) {
    return {
      ...model,
      apiKey: model.apiKey
        ? model.apiKey.length > 8
          ? `${model.apiKey.slice(0, 4)}••••${model.apiKey.slice(-4)}`
          : '••••••••'
        : '',
      hasApiKey: Boolean(model.apiKey),
      params: JSON.parse(model.params),
      createdAt: model.createdAt.getTime(),
    };
  }

  private data(input: ModelInput) {
    return {
      category: input.category,
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      baseURL: input.baseURL,
      apiKey: input.apiKey ?? '',
      enabled: input.enabled,
      description: input.description,
      params: JSON.stringify(input.params),
    };
  }

  private async normalizeDefault(category: string) {
    const models = await this.prisma.modelConfig.findMany({
      where: { category },
      orderBy: { createdAt: 'asc' },
    });
    const current = models.find((model) => model.isDefault && model.enabled);
    const next = current ?? models.find((model) => model.enabled);
    await this.prisma.modelConfig.updateMany({
      where: { category },
      data: { isDefault: false },
    });
    if (next) {
      await this.prisma.modelConfig.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  async list() {
    const models = await this.prisma.modelConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return models.map((model) => this.present(model));
  }

  async create(input: ModelInput) {
    const count = await this.prisma.modelConfig.count({
      where: { category: input.category },
    });
    const model = await this.prisma.modelConfig.create({
      data: {
        ...this.data(input),
        id: input.id ?? crypto.randomUUID(),
        isDefault: count === 0,
      },
    });
    await this.normalizeDefault(input.category);
    return this.present(model);
  }

  async import(models: ModelInput[], defaults: Record<string, string>) {
    if ((await this.prisma.modelConfig.count()) > 0) return this.list();
    await this.prisma.$transaction(
      models.map((model) =>
        this.prisma.modelConfig.create({
          data: {
            ...this.data(model),
            id: model.id ?? crypto.randomUUID(),
            isDefault: defaults[model.category] === model.id,
          },
        }),
      ),
    );
    for (const category of new Set(models.map((model) => model.category))) {
      await this.normalizeDefault(category);
    }
    return this.list();
  }

  async update(id: string, input: ModelInput) {
    const existing = await this.prisma.modelConfig.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('模型不存在');
    const model = await this.prisma.modelConfig.update({
      where: { id },
      data: {
        ...this.data(input),
        apiKey: input.apiKey?.trim() ? input.apiKey : existing.apiKey,
      },
    });
    await this.normalizeDefault(model.category);
    if (existing.category !== model.category) {
      await this.normalizeDefault(existing.category);
    }
    return this.present(model);
  }

  async remove(id: string) {
    const model = await this.prisma.modelConfig.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('模型不存在');
    await this.prisma.modelConfig.delete({ where: { id } });
    await this.normalizeDefault(model.category);
  }

  async toggle(id: string) {
    const model = await this.prisma.modelConfig.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('模型不存在');
    const updated = await this.prisma.modelConfig.update({
      where: { id },
      data: { enabled: !model.enabled },
    });
    await this.normalizeDefault(model.category);
    return this.present(updated);
  }

  async setDefault(id: string) {
    const model = await this.prisma.modelConfig.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('模型不存在');
    if (!model.enabled) throw new BadRequestException('停用模型不能设为默认');
    await this.prisma.$transaction([
      this.prisma.modelConfig.updateMany({
        where: { category: model.category },
        data: { isDefault: false },
      }),
      this.prisma.modelConfig.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
  }

  async runtime(id: string | undefined, category: string) {
    const model = id
      ? await this.prisma.modelConfig.findFirst({ where: { id, category } })
      : await this.prisma.modelConfig.findFirst({
          where: { category, enabled: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });
    if (!model || !model.enabled) {
      throw new BadRequestException('所选模型不存在或已停用');
    }
    if (!model.modelId || !model.baseURL || !model.apiKey) {
      throw new BadRequestException(
        '模型配置不完整，请先完善模型 ID、接口地址和 API Key',
      );
    }
    return model;
  }
}
