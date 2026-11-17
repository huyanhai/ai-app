"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentSkills } from "@/api/agent/skill";
import type { AgentSkillDto } from "@/api/agent/type";
import type { SkillsStatus } from "@/lib/agent/skills";

export function useSkillCatalog(open: boolean) {
  const [skills, setSkills] = useState<AgentSkillDto[]>([]);
  const [status, setStatus] = useState<SkillsStatus>("loading");
  const latest = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setStatus((current) => current === "ready" ? current : "loading");
    try {
      const list = await getAgentSkills();
      if (ticket !== latest.current) return;
      setSkills(list);
      setStatus("ready");
    } catch {
      if (ticket === latest.current) setStatus((current) => current === "ready" ? current : "error");
    }
  }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);
  return { skills, status, reload: load };
}

