import { KPIDefinition, SalesMetricResult, SalesMonthlyActuals } from '../types';

/**
 * Computes METRIC KPI scores (actual number vs monthly target) for the Sales/TeleSales
 * module, per the rules in the KESRA Performance Evaluation document:
 *
 *   نقاط المؤشر = نسبة التحقيق × وزن المؤشر، وبحد أقصى وزن المؤشر.
 *   مثال: 24 اجتماعًا من 30 (وزن 25) = 24/30 × 25 = 20 نقطة.
 *
 * This is deliberately a separate file from calculationEngine.ts rather than an
 * extension of it. CalculationEngine.calculateScores() rescales a Team Leader's
 * DEPARTMENT-category weight from 60 down to 40 (kpi.weight / 60 * 40), because in
 * every other department a Team Leader's 60 points are split into 40 department +
 * 20 leadership. Sales/TeleSales Team Leaders do not follow that split — their own
 * 60 points (e.g. "تحصيله الشخصي" 35 + "تحصيل الموظف الجديد" 10 + ... ) are a complete,
 * standalone set with no separate 20% leadership bucket. Running them through the
 * shared engine would silently shrink every Sales Team Leader's score by a third.
 * Keeping this logic in its own file avoids touching calculationEngine.ts (which every
 * other department relies on) and keeps the Sales-specific rules in one place.
 */
export class SalesCalculationEngine {
  /**
   * نسبة التحقيق لمؤشر "الأعلى أفضل" (عدد اجتماعات، تحصيل، نسبة تحويل...)، بحد أقصى 1
   * (100%) حتى لو تجاوز الموظف التارجت — الملف بيحدد "بحد أقصى وزن المؤشر" صراحةً.
   */
  private static higherIsBetterRatio(achieved: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min(1, achieved / target);
  }

  /**
   * نسبة التحقيق لمؤشر "الأقل أفضل" (سرعة أول رد بالثواني فقط حاليًا). الوصول للتارجت
   * أو أسرع منه = نقاط كاملة، وكل ثانية زيادة فوق التارجت بتقلل النقاط تدريجيًا.
   */
  private static lowerIsBetterRatio(achieved: number, target: number): number {
    if (achieved <= 0) return 0;
    return Math.min(1, target / achieved);
  }

  /**
   * صافي التحصيل = التحصيل المؤهل شامل الضريبة ناقص أي استرداد، ولا يقل عن صفر.
   */
  public static calculateNetCollection(grossInclTax: number, refunds: number): number {
    return Math.max(0, grossInclTax - (refunds || 0));
  }

  /**
   * معدل AOV = إجمالي قيمة الصفقات ÷ عدد الصفقات. بدون صفقات هذا الشهر = غير منطبق
   * (null)، وليس صفرًا — نفس قاعدة "مؤشر بدون حالات مستحقة" في الملف.
   */
  public static calculateAOV(dealsValueTotal: number, dealsCount: number): number | null {
    if (!dealsCount || dealsCount <= 0) return null;
    return dealsValueTotal / dealsCount;
  }

  /**
   * تحويل الفريق محسوب من إجمالي عملاء الفريق مجمّعين (totalConverted ÷ totalLeads)،
   * وليس متوسط نسب تحويل كل عضو لوحده — هذا الفرق مذكور صراحةً في قواعد الحساب لمنع
   * تحيز لصالح عضو بعدد عملاء قليل ونسبة عالية.
   */
  public static calculateTeamConversionPercent(
    totalConverted: number,
    totalLeads: number
  ): number | null {
    if (!totalLeads || totalLeads <= 0) return null;
    return (totalConverted / totalLeads) * 100;
  }

  /**
   * هل مهلة الـ14 يوم لآخر Lead في الشهر لسه مفتوحة؟ لو أيوه، أي نتيجة تحويل مبنية على
   * ليدز الشهر ده تتحط عليها علامة "مبدئي" لحد ما تقفل المهلة، زي ما الملف بينص.
   */
  public static isConversionProvisional(leadWindowClosesAt: string | undefined, asOf: Date = new Date()): boolean {
    if (!leadWindowClosesAt) return false;
    const closesAt = new Date(leadWindowClosesAt);
    if (Number.isNaN(closesAt.getTime())) return false;
    return asOf.getTime() < closesAt.getTime();
  }

  /**
   * نقطة الدخول الرئيسية: تحسب نتيجة مؤشر METRIC واحد. achieved = null معناها "غير
   * منطبق" (لا حالات مستحقة هذا الشهر)، ومفيش targetValue على المؤشر معناها إنه لسه
   * مش متضبط له تارجت رقمي (حالة AOV حاليًا — الملف نفسه معطاش رقم تارجت لـAOV، فمحتاجة
   * نحدد رقم قبل ما يتحول لحساب آلي فعلي، وفضل لحد ذلك "غير منطبق" بدل ما نخترع رقم).
   */
  public static scoreMetricKpi(
    kpi: KPIDefinition,
    achieved: number | null,
    options?: { isProvisional?: boolean; lowerIsBetter?: boolean }
  ): SalesMetricResult {
    if (kpi.measurementType !== 'METRIC') {
      throw new Error(`KPI ${kpi.id} (${kpi.name}) ليس من نوع METRIC — استخدمي scoreMetricKpi بس مع مؤشرات METRIC.`);
    }

    if (achieved === null || kpi.targetValue === undefined) {
      return {
        kpiId: kpi.id,
        achieved,
        target: kpi.targetValue ?? null,
        isApplicable: false,
        isProvisional: false,
        pointsAwarded: 0,
      };
    }

    const ratio = options?.lowerIsBetter
      ? this.lowerIsBetterRatio(achieved, kpi.targetValue)
      : this.higherIsBetterRatio(achieved, kpi.targetValue);

    return {
      kpiId: kpi.id,
      achieved,
      target: kpi.targetValue,
      isApplicable: true,
      isProvisional: options?.isProvisional === true,
      pointsAwarded: Number((ratio * kpi.weight).toFixed(2)),
    };
  }

  /**
   * بتاخد سجل الأرقام الفعلية الشهرية وتعريفات مؤشرات METRIC بتاعة دور الموظف (4 مجموعات
   * ممكنة: TeleSales Agent / TeleSales Team Leader / Sales Agent / Sales Team Leader)،
   * وترجع نتيجة كل مؤشر METRIC محسوبة. مؤشرات RUBRIC (جودة التأهيل، المتابعة، التدريب)
   * مش بتتحسب هنا خالص — تفضل تتقيّم يدويًا زي كل مؤشرات النظام الحالية، من غير أي تغيير.
   */
  public static scoreAllMetricKpis(
    metricKpis: KPIDefinition[],
    actuals: SalesMonthlyActuals | undefined
  ): SalesMetricResult[] {
    return metricKpis
      .filter((kpi) => kpi.measurementType === 'METRIC')
      .map((kpi) => {
        const { achieved, isProvisional, lowerIsBetter } = this.readActualForKpi(kpi, actuals);
        return this.scoreMetricKpi(kpi, achieved, { isProvisional, lowerIsBetter });
      });
  }

  /**
   * بتربط كل مؤشر METRIC بالحقل المناسب ليه في SalesMonthlyActuals. ده المكان الوحيد في
   * الكود اللي فيه الربط ده، عشان لو اتضاف مؤشر METRIC جديد بعدين يتعدل مكان واحد بس.
   */
  private static readActualForKpi(
    kpi: KPIDefinition,
    actuals: SalesMonthlyActuals | undefined
  ): { achieved: number | null; isProvisional: boolean; lowerIsBetter: boolean } {
    if (!actuals) return { achieved: null, isProvisional: false, lowerIsBetter: false };
    const provisional = this.isConversionProvisional(actuals.leadWindowClosesAt);

    switch (kpi.id) {
      case 'kpi-sales-ts-1': // اجتماعات الداتا
        return { achieved: actuals.dataMeetingsActual ?? null, isProvisional: false, lowerIsBetter: false };
      case 'kpi-sales-ts-2': // تحويل الليدز لحضور
        return {
          achieved:
            actuals.leadsReceived && actuals.leadsReceived > 0
              ? ((actuals.leadsConvertedToAttendance || 0) / actuals.leadsReceived) * 100
              : null,
          isProvisional: provisional,
          lowerIsBetter: false,
        };
      case 'kpi-sales-ts-3': // سرعة أول رد
        return { achieved: actuals.avgFirstResponseSeconds ?? null, isProvisional: false, lowerIsBetter: true };
      case 'kpi-sales-ts-tl-1': // اجتماعات الفريق
        return { achieved: actuals.teamMeetingsActual ?? null, isProvisional: false, lowerIsBetter: false };
      case 'kpi-sales-ts-tl-2': // تحويل الفريق
        return {
          achieved: this.calculateTeamConversionPercent(
            actuals.teamLeadsConvertedToAttendance || 0,
            actuals.teamLeadsReceived || 0
          ),
          isProvisional: provisional,
          lowerIsBetter: false,
        };
      case 'kpi-sales-s-1': // التحصيل الشهري
      case 'kpi-sales-s-tl-1': // تحصيله الشخصي (نفس المعادلة)
        return {
          achieved:
            actuals.grossCollectionInclTax !== undefined
              ? this.calculateNetCollection(actuals.grossCollectionInclTax, actuals.refunds || 0)
              : null,
          isProvisional: false,
          lowerIsBetter: false,
        };
      case 'kpi-sales-s-2': // معدل AOV — غير منطبق لحد ما يتحدد تارجت رقمي له
        return {
          achieved: this.calculateAOV(actuals.dealsValueTotal || 0, actuals.dealsCount || 0),
          isProvisional: false,
          lowerIsBetter: false,
        };
      default:
        return { achieved: null, isProvisional: false, lowerIsBetter: false };
    }
  }
}
