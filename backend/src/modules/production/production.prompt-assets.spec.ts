import { markProductionPromptAssets } from './production.prompt-assets';
import { ProductionPlan } from './production.types';

const plan = {
  characters: [
    { id: 'character-1', name: '长颈鹿', description: '', referencePrompt: '' },
    { id: 'character-2', name: '长颈鹿宝宝', description: '', referencePrompt: '' },
  ],
  sceneAssets: [{
    id: 'scene-asset-1', title: '非洲草原', location: '草原正午', referencePrompt: '',
  }],
  scenes: [{
    id: 'scene-1', title: '草原正午', location: '草原正午', sceneAssetId: 'scene-asset-1',
    script: '', shots: [],
  }],
} as ProductionPlan;

describe('markProductionPromptAssets', () => {
  it('marks every character and scene occurrence without nesting existing marks', () => {
    const prompt = '[长颈鹿]弯下腰，长颈鹿宝宝走近非洲草原，[非洲草原]阳光灿烂';
    expect(markProductionPromptAssets(prompt, plan, plan.scenes[0])).toBe(
      '[长颈鹿]弯下腰，[长颈鹿宝宝]走近[非洲草原]，[非洲草原]阳光灿烂',
    );
  });

  it('leaves props and unrelated bracketed content unchanged', () => {
    expect(markProductionPromptAssets('[SFX] 水洼泛起涟漪', plan, plan.scenes[0])).toBe(
      '[SFX] 水洼泛起涟漪',
    );
  });
});
