/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const qualityEvalSettings = pgTable("quality_eval_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  settingKey: varchar("setting_key", { length: 50 }).notNull().unique(),
  settingValue: text("setting_value"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("quality_eval_settings_setting_key_key").on(table.settingKey),
]);

export const qualityEvalOperationLogs = pgTable("quality_eval_operation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorStudentId: varchar("operator_student_id", { length: 50 }).notNull(),
  operatorName: varchar("operator_name", { length: 100 }),
  operatorRole: varchar("operator_role", { length: 20 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(),
  targetStudentId: varchar("target_student_id", { length: 50 }),
  targetStudentName: varchar("target_student_name", { length: 100 }),
  detail: text("detail"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_quality_eval_logs_type").on(table.operationType),
  index("idx_quality_eval_logs_operator").on(table.operatorStudentId),
  index("idx_quality_eval_logs_created").on(table.createdAt),
]);

export const qualityEvalUsers = pgTable("quality_eval_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default('student'),
  displayName: varchar("display_name", { length: 100 }),
  className: varchar("class_name", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("quality_eval_users_student_id_key").on(table.studentId),
  index("idx_quality_eval_users_role").on(table.role),
  index("idx_quality_eval_users_student_id").on(table.studentId),
]);

export const qualityEvalRecords = pgTable("quality_eval_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(),
  className: varchar("class_name", { length: 100 }).notNull(),
  studentName: varchar("student_name", { length: 100 }).notNull(),
  totalScore: numeric("total_score").notNull().default('0'),
  /**
   * @type {    categories: Array<{     categoryKey: string;     categoryName: string;     categoryScore: number;     items: Array<{       itemKey: string;       itemName: string;       itemScore: number;       reasons: Array<{ reason: string; score: number }>;     }>;   }>; }
   */
  evalData: jsonb("eval_data").notNull().default('{}'),
  /**
   * @type {    files: Array<{     id: string;     name: string;     url: string;     itemKey: string;   }>; }
   */
  proofFiles: jsonb("proof_files").notNull().default('[]'),
  /**
   * @type { [key: string]: { status: string; comment?: string; reviewerId?: string; reviewedAt?: string } }
   */
  reviewItemStatus: jsonb("review_item_status").notNull().default('{}'),
  resubmitted: boolean("resubmitted").notNull().default(false),
  reviewReasonStatus: jsonb("review_reason_status").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_quality_eval_student_id").on(table.studentId),
  index("idx_quality_eval_created_at").on(table.createdAt),
  uniqueIndex("idx_quality_eval_records_student_id_unique").on(table.studentId),
]);

// table aliases
export const qualityEvalOperationLogsTable = qualityEvalOperationLogs;
export const qualityEvalRecordsTable = qualityEvalRecords;
export const qualityEvalSettingsTable = qualityEvalSettings;
export const qualityEvalUsersTable = qualityEvalUsers;
