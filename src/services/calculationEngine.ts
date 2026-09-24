import {
  Evaluation,
  EvaluationScoreItem,
  KPIDefinition,
  PerformanceClassificationConfig,
  SystemSettings,
  EmployeeLevel
} from '../types';

export interface ScoreCalculationResult {
  commonScore: number;
  departmentScore: number;
  leadershipScore: number;
  finalScore: number;
  classification: string;
  itemScores: EvaluationScoreItem[];
}

export interface WeightValidationResult {
  isValid: boolean;
  commonSum: number;
  departmentSums: Record<string, number>;
  leadershipSum: number;
  headTechMgmtSum: number;
  errors: string[];
}

export class CalculationEngine {
  /**
   * Validate that all weight configurations in the system settings conform strictly to the required sums.
   */
  public static validateWeights(settings: SystemSettings): WeightValidationResult {
    const errors: string[] = [];

    // 1. Common KPIs must sum to settings.commonSkillsPercent (40%)
    const commonSum = settings.commonKPIs
      .filter((k) => k.isActive)
      .reduce((sum, k) => sum + k.weight, 0);

    if (Math.abs(commonSum - settings.commonSkillsPercent) > 0.01) {
      errors.push(
        `Common Skills KPI weights sum to ${commonSum}%, but must equal exactly ${settings.commonSkillsPercent}%.`
      );
    }

    // 2. Department KPIs must sum to settings.deptKpiPercent (60%) per active department
    const deptSums: Record<string, number> = {};
    const departmentIds = Array.from(
      new Set(settings.departmentKPIs.map((k) => k.departmentId || 'generic'))
    );

    for (const dId of departmentIds) {
      const sum = settings.departmentKPIs
        .filter((k) => k.departmentId === dId && k.isActive)
        .reduce((s, k) => s + k.weight, 0);
      deptSums[dId] = sum;

      if (Math.abs(sum - settings.deptKpiPercent) > 0.01 && dId !== 'generic') {
        errors.push(
          `Department (${dId}) KPI weights sum to ${sum}%, but must equal exactly ${settings.deptKpiPercent}%.`
        );
      }
    }

    // 3. Leadership KPIs must sum to settings.tlLeadershipPercent (20%)
    const leadershipSum = settings.leadershipKPIs
      .filter((k) => k.isActive)
      .reduce((sum, k) => sum + k.weight, 0);

    if (Math.abs(leadershipSum - settings.tlLeadershipPercent) > 0.01) {
      errors.push(
        `Team Leader Leadership KPI weights sum to ${leadershipSum}%, but must equal exactly ${settings.tlLeadershipPercent}%.`
      );
    }

    // 4. Head Tech Management KPIs must sum to settings.headTechManagementPercent (20%)
    const headTechMgmtSum = settings.headTechManagementKPIs
      .filter((k) => k.isActive)
      .reduce((sum, k) => sum + k.weight, 0);

    if (Math.abs(headTechMgmtSum - settings.headTechManagementPercent) > 0.01) {
      errors.push(
        `Head Technical Management KPI weights sum to ${headTechMgmtSum}%, but must equal exactly ${settings.headTechManagementPercent}%.`
      );
    }

    return {
      isValid: errors.length === 0,
      commonSum,
      departmentSums: deptSums,
      leadershipSum,
      headTechMgmtSum,
      errors,
    };
  }

  /**
   * Calculates individual contributions and final scores based on level, role, and category weights.
   */
  public static calculateScores(
    scoresInput: Array<{ kpiId: string; score: number; notes?: string }>,
    kpiDefinitions: KPIDefinition[],
    level: EmployeeLevel,
    isHeadTechnical: boolean = false,
    classifications: PerformanceClassificationConfig[]
  ): ScoreCalculationResult {
    let commonContribution = 0;
    let deptContribution = 0;
    let leadershipContribution = 0;

    const itemScores: EvaluationScoreItem[] = [];
    const isTeamLeader = level === 'Team Leader';

    for (const input of scoresInput) {
      // Whole number enforcement 1-10
      const validScore = Math.max(1, Math.min(10, Math.round(input.score)));
      const kpi = kpiDefinitions.find((k) => k.id === input.kpiId);

      if (!kpi) continue;

      let effectiveWeight = kpi.weight;

      // Adjust department functional weights for Team Leaders if needed (60% standard becomes 40% functional for TL)
      if (isTeamLeader && !isHeadTechnical && kpi.category === 'DEPARTMENT') {
        effectiveWeight = (kpi.weight / 60) * 40;
      }

      // Calculate weighted contribution: (score / 10) * effectiveWeight
      const weightedContribution = Number(
        ((validScore / 10) * effectiveWeight).toFixed(2)
      );

      if (kpi.category === 'COMMON') {
        commonContribution += weightedContribution;
      } else if (kpi.category === 'DEPARTMENT') {
        deptContribution += weightedContribution;
      } else if (kpi.category === 'LEADERSHIP' || kpi.category === 'MANAGEMENT') {
        leadershipContribution += weightedContribution;
      }

      itemScores.push({
        id: `score-${kpi.id}`,
        kpiId: kpi.id,
        kpiName: kpi.name,
        category: kpi.category,
        score: validScore,
        weight: Number(effectiveWeight.toFixed(2)),
        weightedContribution,
        notes: input.notes || '',
      });
    }

    const commonScore = Number(commonContribution.toFixed(1));
    const departmentScore = Number(deptContribution.toFixed(1));
    const leadershipScore = isTeamLeader || isHeadTechnical
      ? Number(leadershipContribution.toFixed(1))
      : 0;

    let finalScore = Number(
      (commonScore + departmentScore + (isTeamLeader || isHeadTechnical ? leadershipScore : 0)).toFixed(1)
    );

    // Bound final score between 0 and 100
    finalScore = Math.min(100, Math.max(0, finalScore));

    const classification = this.determineClassification(finalScore, classifications);

    return {
      commonScore,
      departmentScore,
      leadershipScore,
      finalScore,
      classification,
      itemScores,
    };
  }

  /**
   * Determine descriptive classification from score ranges.
   */
  public static determineClassification(
    score: number,
    classifications: PerformanceClassificationConfig[]
  ): string {
    const sorted = [...classifications].sort((a, b) => b.minScore - a.minScore);
    for (const cls of sorted) {
      if (score >= cls.minScore && score <= cls.maxScore + 0.001) {
        return cls.label;
      }
    }
    return score >= 90
      ? 'Excellent'
      : score >= 80
      ? 'Very Good'
      : score >= 70
      ? 'Good'
      : score >= 60
      ? 'Needs Improvement'
      : 'Needs Attention';
  }

  /**
   * Recalculate and update ranks for all evaluations in a given department and quarter.
   */
  public static recalculateDepartmentRanks(
    evaluations: Evaluation[],
    departmentId: string,
    quarter: string,
    year: number
  ): Evaluation[] {
    // Filter evaluations matching department, cycle, and eligibility
    const deptEvals = evaluations.filter(
      (e) =>
        e.departmentId === departmentId &&
        e.quarter === quarter &&
        e.year === year &&
        e.isEligible
    );

    // Sort by finalScore descending
    deptEvals.sort((a, b) => b.finalScore - a.finalScore);

    const totalInDept = deptEvals.length;

    const updated = evaluations.map((evaluation) => {
      if (
        evaluation.departmentId === departmentId &&
        evaluation.quarter === quarter &&
        evaluation.year === year &&
        evaluation.isEligible
      ) {
        const rankIndex = deptEvals.findIndex((e) => e.id === evaluation.id);
        return {
          ...evaluation,
          departmentRank: rankIndex !== -1 ? rankIndex + 1 : 1,
          totalInDepartment: totalInDept,
        };
      }
      return evaluation;
    });

    return updated;
  }

  /**
   * Check employee tenure eligibility. Minimum months required: default 2.
   */
  public static checkEligibility(
    startDate: string,
    cycleDate: string = new Date().toISOString(),
    minMonths: number = 2
  ): { isEligible: boolean; tenureMonths: number; reason?: string } {
    const start = new Date(startDate);
    const target = new Date(cycleDate);

    let months = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    if (target.getDate() < start.getDate()) {
      months -= 1;
    }
    months = Math.max(0, months);

    if (months < minMonths) {
      return {
        isEligible: false,
        tenureMonths: months,
        reason: `NOT ELIGIBLE: Completed ${months} month(s) of employment. Minimum required is ${minMonths} months.`,
      };
    }

    return {
      isEligible: true,
      tenureMonths: months,
    };
  }
}
