import React from "react";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type {
  ScoringRuleProject,
  ScoringRuleLevelGroup,
  ScoringRuleOption,
} from '@shared/api.interface';

interface ScoringRulePanelProps {
  maxScore: number;
  earnedPositive: number;
  remaining: number;
  positiveProjects: ScoringRuleProject[];
  negativeProjects: ScoringRuleProject[];
}

function getProjectMaxScore(project: ScoringRuleProject): number {
  let max = 0;
  for (const lg of project.levelGroups) {
    for (const opt of lg.options) {
      if (Math.abs(opt.score) > max) max = Math.abs(opt.score);
    }
  }
  return max;
}

function ProjectCard({
  project,
  variant,
}: {
  project: ScoringRuleProject;
  variant: 'positive' | 'negative';
}) {
  const maxScore = getProjectMaxScore(project);
  const isPositive = variant === 'positive';
  const borderClass = isPositive
    ? 'border-emerald-200/60'
    : 'border-rose-200/60';
  const badgeClass = isPositive
    ? 'bg-emerald-500 hover:bg-emerald-600'
    : 'bg-rose-500 hover:bg-rose-600';
  const sign = isPositive ? '+' : '-';

  return (
    <Card className={borderClass}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{project.projectName}</span>
          <Badge variant="default" className={`${badgeClass} text-xs`}>
            {sign}
            {maxScore}
          </Badge>
        </div>

        <div className="mt-2 space-y-2">
          {project.levelGroups.map((lg: ScoringRuleLevelGroup) => (
            <div key={lg.levelKey}>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {lg.levelName}
              </div>
              <div className="flex flex-wrap gap-1">
                {lg.options.map((opt: ScoringRuleOption) => (
                  <div key={opt.optionKey} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {opt.optionName} {sign}
                      {opt.score}
                    </Badge>
                    {opt.needProof && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-600 bg-amber-50"
                      >
                        需证明
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {project.remark && (
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {project.remark}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export const ScoringRulePanel: React.FC<ScoringRulePanelProps> = ({
  maxScore,
  earnedPositive,
  remaining,
  positiveProjects,
  negativeProjects,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-muted p-2 text-center">
          <div className="text-xs text-muted-foreground">最高分值</div>
          <div className="font-bold text-base">{maxScore}</div>
        </div>
        <div className="rounded-md bg-emerald-50 p-2 text-center">
          <div className="text-xs text-emerald-600">已得分</div>
          <div className="font-bold text-base text-emerald-600">
            {earnedPositive}
          </div>
        </div>
        <div className="rounded-md bg-amber-50 p-2 text-center">
          <div className="text-xs text-amber-600">剩余额度</div>
          <div className="font-bold text-base text-amber-600">{remaining}</div>
        </div>
      </div>

      {positiveProjects.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            正向加分项目
          </h4>
          <div className="space-y-2">
            {positiveProjects.map((project: ScoringRuleProject) => (
              <ProjectCard
                key={project.projectKey}
                project={project}
                variant="positive"
              />
            ))}
          </div>
        </div>
      )}

      {negativeProjects.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            负向扣分项目
          </h4>
          <div className="space-y-2">
            {negativeProjects.map((project: ScoringRuleProject) => (
              <ProjectCard
                key={project.projectKey}
                project={project}
                variant="negative"
              />
            ))}
          </div>
        </div>
      )}

      {positiveProjects.length === 0 && negativeProjects.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          暂无评分标准
        </p>
      )}
    </div>
  );
};
