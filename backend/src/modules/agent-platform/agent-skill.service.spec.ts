import { AgentSkillService } from './agent-skill.service';

describe('AgentSkillService', () => {
  it('uses directory IDs for both the new catalog and message references', async () => {
    const service = new AgentSkillService();
    const skills = await service.list();
    const skill = skills.find((item) => item.name === 'short-drama-develop');
    expect(skill).toMatchObject({
      id: 'short-drama-develop',
      name: 'short-drama-develop',
      source: 'builtin',
    });
    expect(skill.title.length).toBeGreaterThan(0);
    expect(skill.description.length).toBeGreaterThan(0);
    expect((await service.names()).has('short-drama-develop')).toBe(true);
  });
});
