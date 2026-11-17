import { agentRequest } from "@/lib/agent/http";
import type { AgentSkillDto } from "./type";

export const getAgentSkills = async (): Promise<AgentSkillDto[]> =>
  (await agentRequest<AgentSkillDto[] | null>("/skills")) ?? [];
