import { ProductionPlan } from './production.types';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function markProductionPromptAssets(
  prompt: string,
  plan: ProductionPlan,
  scene: ProductionPlan['scenes'][number],
) {
  const sceneAsset = plan.sceneAssets?.find(
    (asset) => asset.id === scene.sceneAssetId,
  );
  const names = [
    ...plan.characters.map((character) => character.name),
    scene.title,
    scene.location,
    sceneAsset?.title,
    sceneAsset?.location,
  ].filter((name): name is string => Boolean(name?.trim()));
  const uniqueNames = [...new Set(names)].sort(
    (left, right) => right.length - left.length,
  );
  if (!prompt || !uniqueNames.length) return prompt;
  const pattern = new RegExp(uniqueNames.map(escapeRegExp).join('|'), 'g');
  return prompt
    .split(/(\[[^\]]*\])/g)
    .map((part) =>
      part.startsWith('[')
        ? part
        : part.replace(pattern, (name) => `[${name}]`),
    )
    .join('');
}
