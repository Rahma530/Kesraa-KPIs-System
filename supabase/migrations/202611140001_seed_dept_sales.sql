-- Add the Sales/TeleSales department (dept-sales) to production: the department row,
-- its 20 department KPIs in public.settings, and a template for the real employees.
--
-- GENERATED from src/config/initialData.ts (dept-sales KPIs only). Do not hand-edit the
-- JSON array below except to fix a real data bug — regenerate from source instead.
-- Source content fingerprint (sha256, first 16): deecec2b986b24f7
--
-- Contents: 1 department row (dept-sales / "Sales"), 20 department KPIs
--           (5 TeleSales Agent, 6 Head Of Tele-Sales, 4 Sales Agent, 5 Head Of Sales).
--           Each role's KPIs already sum to 60 on their own (standalone department
--           weights for Sales/TeleSales Team Leaders -- do NOT apply the generic 60->40
--           Team Leader rescale to these; the app code already knows this
--           via hasStandaloneDepartmentWeights).
--
-- NOT APPLIED AUTOMATICALLY. Review, then run once in the SQL editor, only after the
-- feature/sales-kpi-module code is deployed (so the frontend can read measurementType/
-- targetValue/supportsNotApplicable correctly).
--
-- Re-running fails safely: step 1 is idempotent (ON CONFLICT DO NOTHING), and step 2
-- checks first whether any dept-sales KPI is already present before appending again.

begin;

-- 1. Add the department row. Harmless to re-run.
insert into public.departments (id, name)
values ('dept-sales', 'Sales')
on conflict (id) do nothing;

-- 2. Append the 20 Sales/TeleSales KPIs to the existing department_kpis array,
--    but only if they are not already there (guards against double-running).
do $seed$
declare
  already_present boolean;
begin
  select exists (
    select 1
    from public.settings s,
         jsonb_array_elements(s.department_kpis) as kpi
    where s.id = 'sys-settings'
      and kpi ->> 'departmentId' = 'dept-sales'
  ) into already_present;

  if already_present then
    raise notice 'dept-sales KPIs already present in public.settings -- skipping append.';
  else
    update public.settings
    set department_kpis = department_kpis || $sales_kpis$[{"id":"kpi-sales-ts-1","name":"اجتماعات الداتا (Data Meetings)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"TeleSales Agent","weight":25,"description":"عدد الاجتماعات الفعلية المحجوزة والمنعقدة من قاعدة الليدز خلال الشهر. المستهدف 30 اجتماعًا شهريًا.","measurementType":"METRIC","metricUnit":"COUNT","targetValue":30,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (العدد الفعلي ÷ 30) × 25، بحد أقصى 25.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-ts-2","name":"تحويل الـLeads لحضور خلال 14 يومًا (Lead-to-Attendance Conversion)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"TeleSales Agent","weight":20,"description":"نسبة الليدز اللي حضرت فعليًا خلال 14 يوم من استلامها. المستهدف 80%. تفضل النتيجة مبدئية لحد ما تنتهي مهلة الـ14 يوم لآخر Lead في الشهر.","measurementType":"METRIC","metricUnit":"PERCENT","targetValue":80,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (نسبة التحويل الفعلية ÷ 80%) × 20، بحد أقصى 20، وبعلامة \"مبدئي\" حتى إغلاق الشهر.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-ts-3","name":"سرعة أول رد خلال دقيقتين (First Response Speed)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"TeleSales Agent","weight":5,"description":"متوسط زمن أول رد على الـLead، والمعيار دقيقتان أو أقل.","measurementType":"METRIC","metricUnit":"SECONDS","targetValue":120,"scoringGuide":{"excellent":"محسوب آليًا من متوسط زمن الرد الفعلي مقابل 120 ثانية، بحد أقصى 5 نقاط.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-ts-4","name":"الالتزام بالمتابعات (Follow-up Compliance)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"TeleSales Agent","weight":5,"description":"نسبة المتابعات المجدولة اللي تمت فعليًا في مواعيدها من إجمالي المتابعات المفروضة.","scoringGuide":{"excellent":"9-10: التزام شبه كامل بكل المتابعات المجدولة في مواعيدها.","good":"7-8: التزام جيد مع فوات بسيط نادر.","needsImprovement":"5-6: فوات متكرر لمتابعات مهمة.","poor":"3-4: إهمال واضح لجدول المتابعات.","critical":"1-2: انعدام الالتزام بالمتابعات بالكامل."},"isActive":true},{"id":"kpi-sales-ts-5","name":"جودة التأهيل وتسجيل البيانات (Qualification & Data Quality)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"TeleSales Agent","weight":5,"description":"دقة تصنيف الـLead ودقة تسجيل بياناته في النظام.","scoringGuide":{"excellent":"9-10: تصنيف دقيق وتسجيل بيانات كامل وصحيح لكل Lead.","good":"7-8: تصنيف وتسجيل جيدين مع أخطاء بسيطة نادرة.","needsImprovement":"5-6: أخطاء متكررة في التصنيف أو نقص في البيانات المسجلة.","poor":"3-4: تسجيل بيانات ضعيف يصعّب المتابعة.","critical":"1-2: بيانات غائبة أو مغلوطة بشكل كبير."},"isActive":true},{"id":"kpi-sales-ts-tl-1","name":"اجتماعات الفريق (Team Meetings)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":20,"description":"إجمالي اجتماعات الداتا لكل أعضاء الفريق مجمّعين. المستهدف 120 اجتماعًا شهريًا للفريق.","measurementType":"METRIC","metricUnit":"COUNT","targetValue":120,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (الإجمالي الفعلي ÷ 120) × 20، بحد أقصى 20.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-ts-tl-2","name":"تحويل الفريق (Team Conversion)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":20,"description":"نسبة تحويل الفريق محسوبة من إجمالي عملاء الفريق مجمّعين، مش من متوسط نسب الأفراد. المستهدف 80%.","measurementType":"METRIC","metricUnit":"PERCENT","targetValue":80,"scoringGuide":{"excellent":"محسوب آليًا من إجمالي تحويل الفريق مقابل 80%، بحد أقصى 20 نقطة، وبعلامة \"مبدئي\" حتى إغلاق الشهر.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-ts-tl-3","name":"سرعة الرد (Team Response Speed)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":5,"description":"التزام الفريق ككل بمعيار الرد خلال دقيقتين.","scoringGuide":{"excellent":"9-10: الفريق كله ملتزم بمعيار الدقيقتين تقريبًا بالكامل.","good":"7-8: التزام جيد مع استثناءات قليلة.","needsImprovement":"5-6: تجاوزات متكررة لمعيار سرعة الرد.","poor":"3-4: تأخر واضح في رد أعضاء الفريق.","critical":"1-2: إهمال شبه كامل لسرعة الرد."},"isActive":true},{"id":"kpi-sales-ts-tl-4","name":"المتابعات (Team Follow-up Compliance)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":5,"description":"التزام الفريق ككل بالمتابعات المجدولة.","scoringGuide":{"excellent":"9-10: الفريق ملتزم بكل متابعاته في مواعيدها.","good":"7-8: التزام جيد مع فوات بسيط نادر.","needsImprovement":"5-6: فوات متكرر على مستوى الفريق.","poor":"3-4: إهمال واضح لمتابعات الفريق.","critical":"1-2: انعدام الالتزام بالكامل."},"isActive":true},{"id":"kpi-sales-ts-tl-5","name":"جودة التأهيل (Team Qualification Quality)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":5,"description":"جودة تأهيل وتسجيل البيانات على مستوى الفريق ككل.","scoringGuide":{"excellent":"9-10: جودة تأهيل وتسجيل عالية عبر الفريق كله.","good":"7-8: جودة جيدة مع أخطاء بسيطة متفرقة.","needsImprovement":"5-6: تفاوت ملحوظ في جودة التأهيل بين أعضاء الفريق.","poor":"3-4: جودة ضعيفة عمومًا.","critical":"1-2: بيانات غير موثوقة على مستوى الفريق."},"isActive":true},{"id":"kpi-sales-ts-tl-6","name":"المراجعة والتدريب (Review & Coaching)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Tele-Sales","weight":5,"description":"مدى قيام التيم ليدر بمراجعة أداء أعضاء الفريق وتدريبهم بشكل دوري.","scoringGuide":{"excellent":"9-10: مراجعة وتدريب منتظمين وموثقين لكل أعضاء الفريق.","good":"7-8: مراجعة وتدريب جيدين بانتظام مقبول.","needsImprovement":"5-6: مراجعة غير منتظمة أو تدريب محدود.","poor":"3-4: مراجعة وتدريب نادران.","critical":"1-2: غياب شبه كامل للمراجعة والتدريب."},"isActive":true},{"id":"kpi-sales-s-1","name":"التحصيل الشهري (Monthly Net Collection)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Sales Agent","weight":35,"description":"صافي التحصيل = التحصيل المؤهل شامل الضريبة ناقص أي استرداد. المستهدف 20,000 لاير شهريًا للفرد.","measurementType":"METRIC","metricUnit":"SAR","targetValue":20000,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (صافي التحصيل ÷ 20,000) × 35، بحد أقصى 35.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-s-2","name":"معدل AOV (Average Order Value)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Sales Agent","weight":10,"description":"متوسط قيمة الصفقة = إجمالي قيمة الصفقات المغلقة ÷ عدد الصفقات. المستهدف ألا يقل عن 2,500 ريال للصفقة. بدون حالات مستحقة هذا الشهر = غير منطبق.","measurementType":"METRIC","metricUnit":"SAR","targetValue":2500,"supportsNotApplicable":true,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (متوسط قيمة الصفقة ÷ 2,500) × 10، بحد أقصى 10. بدون صفقات هذا الشهر: غير منطبق (لا صفر ولا كامل الوزن).","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-s-3","name":"متابعة العملاء (Client Follow-up)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Sales Agent","weight":10,"description":"التزام السيلز بمتابعة العملاء بعد البيع: متابعات دورية، تذكير بالتجديد، التأكد من الرضا.","scoringGuide":{"excellent":"9-10: متابعة منتظمة وموثقة لكل العملاء بعد البيع.","good":"7-8: متابعة جيدة مع فجوات بسيطة نادرة.","needsImprovement":"5-6: متابعة متقطعة لبعض العملاء.","poor":"3-4: متابعة ضعيفة بشكل عام.","critical":"1-2: إهمال شبه كامل لمتابعة العملاء بعد البيع."},"isActive":true},{"id":"kpi-sales-s-4","name":"دقة البيانات والعقود (Contract & Data Accuracy)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Sales Agent","weight":5,"description":"صحة البيانات المسجلة في العقود: المبالغ، التواريخ، الشروط، بيانات العميل.","scoringGuide":{"excellent":"9-10: عقود دقيقة بالكامل من غير أي أخطاء إدخال.","good":"7-8: دقة جيدة مع أخطاء بسيطة نادرة.","needsImprovement":"5-6: أخطاء متكررة في بيانات العقود.","poor":"3-4: أخطاء تؤثر على دقة العقد أو المتابعة.","critical":"1-2: بيانات عقود غير موثوقة."},"isActive":true},{"id":"kpi-sales-s-tl-1","name":"تحصيله الشخصي (Personal Collection)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Sales","weight":35,"description":"نفس مؤشر التحصيل الشهري الخاص بالسيلز، لكن لتحصيل التيم ليدر الشخصي. المستهدف 20,000 لاير شهريًا.","measurementType":"METRIC","metricUnit":"SAR","targetValue":20000,"scoringGuide":{"excellent":"محسوب آليًا: النقاط = (صافي التحصيل الشخصي ÷ 20,000) × 35، بحد أقصى 35.","good":"نفس المعادلة أعلاه.","needsImprovement":"نفس المعادلة أعلاه.","poor":"نفس المعادلة أعلاه.","critical":"نفس المعادلة أعلاه."},"isActive":true},{"id":"kpi-sales-s-tl-2","name":"تحصيل الموظف الجديد (New Hire Collection)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Sales","weight":10,"description":"مدى نجاح التيم ليدر في تأهيل الموظف الجديد عشان يوصل لمستوى تحصيل مقبول.","scoringGuide":{"excellent":"9-10: الموظف الجديد وصل لمستوى تحصيل قوي بسرعة بفضل التأهيل.","good":"7-8: تقدم جيد ومستمر في تحصيل الموظف الجديد.","needsImprovement":"5-6: تقدم بطيء في تحصيل الموظف الجديد.","poor":"3-4: الموظف الجديد لسه ضعيف في التحصيل من غير دعم واضح.","critical":"1-2: غياب شبه كامل للتأهيل والدعم."},"isActive":true},{"id":"kpi-sales-s-tl-3","name":"المتابعات (Team Client Follow-up)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Sales","weight":5,"description":"التزام الفريق ككل بمتابعة العملاء بعد البيع.","scoringGuide":{"excellent":"9-10: الفريق كله ملتزم بالمتابعة بعد البيع.","good":"7-8: التزام جيد مع فجوات بسيطة.","needsImprovement":"5-6: متابعة متقطعة من بعض أعضاء الفريق.","poor":"3-4: متابعة ضعيفة على مستوى الفريق.","critical":"1-2: إهمال شبه كامل للمتابعة."},"isActive":true},{"id":"kpi-sales-s-tl-4","name":"دقة السجلات (Team Records Accuracy)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Sales","weight":5,"description":"دقة سجلات وعقود الفريق ككل.","scoringGuide":{"excellent":"9-10: سجلات دقيقة بالكامل عبر الفريق.","good":"7-8: دقة جيدة مع أخطاء بسيطة نادرة.","needsImprovement":"5-6: أخطاء متكررة في سجلات بعض الأعضاء.","poor":"3-4: سجلات غير دقيقة بشكل ملحوظ.","critical":"1-2: سجلات غير موثوقة على مستوى الفريق."},"isActive":true},{"id":"kpi-sales-s-tl-5","name":"تدريب الموظف الجديد (New Hire Training)","category":"DEPARTMENT","departmentId":"dept-sales","roleName":"Head Of Sales","weight":5,"description":"مجهود التيم ليدر الفعلي في تدريب وتأهيل الموظفين الجدد.","scoringGuide":{"excellent":"9-10: برنامج تدريب منظم وموثق للموظفين الجدد.","good":"7-8: تدريب جيد ومنتظم بشكل مقبول.","needsImprovement":"5-6: تدريب غير منتظم.","poor":"3-4: تدريب محدود جدًا.","critical":"1-2: غياب شبه كامل للتدريب."},"isActive":true}]$sales_kpis$::jsonb,
        updated_at = now()
    where id = 'sys-settings';
  end if;
end
$seed$;

commit;

-- ---------------------------------------------------------------------------------
-- 3. Real employees for dept-sales (NOT part of the transaction above -- fill in the
--    real name/email/phone/start_date for each placeholder row below, confirm with
--    the business owner, then run separately). All three leadership rows must use
--    job_title EXACTLY as written: the app reads "role" as job_title first, and the
--    Sales-module code (getSalesTrack, canApproveEvaluation, isWithinTeamLeaderScope)
--    matches on these exact strings. employment_active=true, account_enabled=false --
--    enabling the account happens later, automatically, when invite-employee links a
--    real Auth user to the row.
--
-- insert into public.employees
--   (id, name, email, phone, department_id, job_title, level, system_role,
--    start_date, employment_active, account_enabled, employee_version, created_at, updated_at)
-- values
--   ('emp-sales-manager', '<REAL NAME>', '<real.email@kesraa.com>', '<phone>',
--    'dept-sales', 'Sales Manager', 'Team Leader', 'TEAM_LEADER',
--    '<YYYY-MM-DD>', true, false, 1, now(), now()),
--   ('emp-head-of-sales', '<REAL NAME>', '<real.email@kesraa.com>', '<phone>',
--    'dept-sales', 'Head Of Sales', 'Team Leader', 'TEAM_LEADER',
--    '<YYYY-MM-DD>', true, false, 1, now(), now()),
--   ('emp-head-of-telesales', '<REAL NAME>', '<real.email@kesraa.com>', '<phone>',
--    'dept-sales', 'Head Of Tele-Sales', 'Team Leader', 'TEAM_LEADER',
--    '<YYYY-MM-DD>', true, false, 1, now(), now());
--   -- plus one row per Sales Agent / TeleSales Agent, job_title 'Sales Agent' /
--   -- 'TeleSales Agent', level e.g. 'Junior'/'Mid'/'Senior' (never 'Team Leader'),
--   -- system_role 'EMPLOYEE'.
--
-- After these rows exist, use the in-app Employee Management screen (or 'import')
-- instead of raw SQL where possible -- it goes through employee_management_mutate,
-- which writes the matching audit_logs row atomically. Raw SQL above is the fallback
-- only if that screen is not reachable yet (e.g. before any ADMIN account exists in
-- dept-sales to operate it).
