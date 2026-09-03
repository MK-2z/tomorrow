import { useMemo } from 'react';
import scoringRulesData from '@shared/static/data/scoring-rules.json';
import type {
  ScoringRuleItem,
  ScoringRuleProject,
  ScoringRuleLevelGroup,
  ScoringRuleOption,
} from '@shared/api.interface';

export function useScoringRules() {
  const items = useMemo<ScoringRuleItem[]>(() => {
    return scoringRulesData as ScoringRuleItem[];
  }, []);

  const loading = false;

  const getItem = (itemKey: string): ScoringRuleItem | undefined => {
    return items.find((item: ScoringRuleItem) => item.itemKey === itemKey);
  };

  const getProjectsByItem = (itemKey: string): ScoringRuleProject[] => {
    const item = getItem(itemKey);
    return item?.projects ?? [];
  };

  const getLevelGroups = (
    itemKey: string,
    projectKey: string,
  ): ScoringRuleLevelGroup[] => {
    const project = getProjectsByItem(itemKey).find(
      (p: ScoringRuleProject) => p.projectKey === projectKey,
    );
    return project?.levelGroups ?? [];
  };

  const getOptions = (
    itemKey: string,
    projectKey: string,
    levelKey: string,
  ): ScoringRuleOption[] => {
    const levelGroup = getLevelGroups(itemKey, projectKey).find(
      (lg: ScoringRuleLevelGroup) => lg.levelKey === levelKey,
    );
    return levelGroup?.options ?? [];
  };

  const getPositiveProjects = (itemKey: string): ScoringRuleProject[] => {
    return getProjectsByItem(itemKey).filter(
      (p: ScoringRuleProject) => p.type === 'positive',
    );
  };

  const getNegativeProjects = (itemKey: string): ScoringRuleProject[] => {
    return getProjectsByItem(itemKey).filter(
      (p: ScoringRuleProject) => p.type === 'negative',
    );
  };

  return {
    items,
    loading,
    getItem,
    getProjectsByItem,
    getLevelGroups,
    getOptions,
    getPositiveProjects,
    getNegativeProjects,
  };
}
