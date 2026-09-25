/**
 * Seeds the 8 judging criteria + innovation bonus from the official ACS
 * judging document (وثيقة معايير التحكيم المكتب التقني ACS).
 *
 *   npm run seed:criteria         insert missing criteria, leave existing ones
 *   npm run seed:criteria:reset   drop all criteria first (DEV ONLY)
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import JudgingCriteria from '../models/judgingCriteria.model.js';
import { logger } from '../utils/logger.js';

const shouldReset = process.argv.includes('--reset');

const standardLevels = [
  { min: 9, max: 10, label: 'Clearly achieved', labelAr: 'متحقق بوضوح', description: 'Full or near-full achievement with no major issues.' },
  { min: 6, max: 8, label: 'Achieved with notes', labelAr: 'متحقق مع ملاحظات', description: 'Good, with limited and identifiable shortcomings.' },
  { min: 3, max: 5, label: 'Partially achieved', labelAr: 'متحقق جزئياً', description: 'Implementation exists but shortcomings are significant.' },
  { min: 0, max: 2, label: 'Weak / Not achieved', labelAr: 'ضعيف / غير متحقق', description: 'Criterion practically absent or core check failed.' },
];

const innovationBonusLevels = [
  { min: 0, max: 0, label: 'No addition', labelAr: 'لا إضافة مميزة', description: 'No distinctive addition.' },
  { min: 1, max: 2, label: 'Useful addition', labelAr: 'إضافة مفيدة محدودة', description: 'A limited but useful addition.' },
  { min: 3, max: 4, label: 'Clear innovation', labelAr: 'ابتكار واضح ومتكامل', description: 'Clear and integrated innovation.' },
  { min: 5, max: 5, label: 'Exceptional', labelAr: 'تميّز استثنائي نادر', description: 'Exceptionally rare distinction.' },
];

const CRITERIA = [
  {
    key: 'ui_ux',
    name: 'UI / UX Quality',
    nameAr: 'جودة تجربة المستخدم',
    description: 'Core Task Completion — the judge identifies the project\'s most important user flow and executes it end-to-end. The score reflects the user\'s ability to complete it clearly and without blocking issues.',
    descriptionAr: 'نجاح المسار الأساسي للمستخدم — يحدد الحكم أهم مسار في المشروع وينفذه من البداية للنهاية. الدرجة تعكس قدرة المستخدم على إكماله بوضوح ودون عوائق مؤثرة.',
    maxScore: 10,
    order: 1,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'database_design',
    name: 'Database Design',
    nameAr: 'تصميم قاعدة البيانات',
    description: 'Data Model Integrity — review the data structure of the most important function: relationships, fields, and constraints must represent data correctly and maintain consistency without significant duplication or conflict.',
    descriptionAr: 'سلامة نموذج البيانات — تُراجع بنية البيانات المرتبطة بأهم وظيفة: العلاقات والحقول والقيود يجب أن تمثل البيانات بصورة صحيحة وتحافظ على الاتساق.',
    maxScore: 10,
    order: 2,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'security_validation',
    name: 'Security & Validation',
    nameAr: 'الأمان والتحقق',
    description: 'Input & Access Protection — review one sensitive point in the system and verify that invalid or unauthorized states are rejected server-side, not relying on frontend-only protection.',
    descriptionAr: 'حماية حدود النظام — تُراجع نقطة حساسة واحدة من النظام، ويُتحقق أن الحالة غير الصحيحة أو غير المصرح بها تُرفض فعلياً من جهة الخادم.',
    maxScore: 10,
    order: 3,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'innovation',
    name: 'Innovation & Additions',
    nameAr: 'الابتكار والإضافات',
    description: 'Distinctive Added Value — evaluate the addition that distinguishes the project, provided it is implemented, integrated, and delivers real value to the solution or user.',
    descriptionAr: 'القيمة المميزة المطبقة — تُقيّم الإضافة التي تميز المشروع بشرط أن تكون منفذة ومتكاملة وتقدم قيمة حقيقية للحل أو للمستخدم.',
    maxScore: 10,
    order: 4,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'backend',
    name: 'Backend',
    nameAr: 'الخلفية البرمجية',
    description: 'End-to-End Backend Correctness — trace a core request from API entry, through business logic, data handling, and response. The score reflects correctness and handling of expected cases.',
    descriptionAr: 'صحة المعاملة الأساسية من الطرف إلى الطرف — يُتتبع طلب أساسي من دخوله إلى الـAPI مروراً بمنطق الأعمال ثم التعامل مع البيانات وإرجاع النتيجة.',
    maxScore: 10,
    order: 5,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'clean_code',
    name: 'Clean Code',
    nameAr: 'نظافة الكود',
    description: 'Maintainability Trace — the judge picks a core feature and traces its implementation. Higher scores when logic placement is clear, naming is understandable, and responsibilities are separated.',
    descriptionAr: 'قابلية تتبع وصيانة ميزة أساسية — يختار الحكم ميزة أساسية ويتتبع تنفيذها. ترتفع الدرجة عندما يكون مكان المنطق واضحاً والتسمية مفهومة.',
    maxScore: 10,
    order: 6,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'performance_stability',
    name: 'Performance & Stability',
    nameAr: 'الأداء والاستقرار',
    description: 'Repeatable Core Flow — execute the core flow repeatedly under the same judging conditions. The score reflects continued success without intermittent errors or noticeable slowness.',
    descriptionAr: 'ثبات المسار الأساسي تحت التكرار — يُنفذ المسار الأساسي بصورة متكررة في ظروف التحكيم نفسها. الدرجة تعكس استمرار نجاحه دون أخطاء متقطعة.',
    maxScore: 10,
    order: 7,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'functionality_completeness',
    name: 'Functionality & Completeness',
    nameAr: 'الوظائف واكتمال النظام',
    description: 'Core Feature Coverage — match the core features the team presented as part of their solution against actual implementation. The score reflects working end-to-end core features.',
    descriptionAr: 'نسبة اكتمال الوظائف الأساسية المعلنة — تُطابق الوظائف الأساسية التي قدمها الفريق بوصفها جزءاً من الحل مع التنفيذ الفعلي.',
    maxScore: 10,
    order: 8,
    isBonus: false,
    gradeLevels: standardLevels,
  },
  {
    key: 'innovation_bonus',
    name: 'Innovation Bonus',
    nameAr: 'رصيد الابتكار الإضافي',
    description: 'Awarded above the base 80 based on originality, depth of implementation, and value of the addition. Not used to compensate for weak core functions.',
    descriptionAr: 'يمنح فوق مجموع 80 بحسب أصالة الفكرة وعمق التنفيذ وقيمة الإضافة. لا يستخدم لتعويض ضعف الوظائف الأساسية.',
    maxScore: 5,
    order: 9,
    isBonus: true,
    gradeLevels: innovationBonusLevels,
  },
];

const run = async () => {
  if (shouldReset && env.isProduction) {
    logger.error('Refusing to run --reset with NODE_ENV=production.');
    process.exit(1);
  }

  await connectDatabase();
  logger.info(`Seeding judging criteria into: ${mongoose.connection.name}`);

  if (shouldReset) {
    const result = await JudgingCriteria.deleteMany({});
    logger.warn(`  ! reset: removed ${result.deletedCount} criteria`);
  }

  for (const data of CRITERIA) {
    const existing = await JudgingCriteria.findOne({ key: data.key });
    if (existing) {
      logger.info(`  = ${data.key.padEnd(30)} (already exists, skipped)`);
    } else {
      await JudgingCriteria.create(data);
      logger.info(`  + ${data.key.padEnd(30)} ${data.name}`);
    }
  }

  logger.info('Criteria seed complete.');
  await disconnectDatabase();
  process.exit(0);
};

run().catch(async (error) => {
  logger.error('Criteria seed failed:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
