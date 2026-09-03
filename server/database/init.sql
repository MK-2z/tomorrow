-- 素质评价平台数据库初始化脚本

-- 创建自定义类型
DO $$ BEGIN
  CREATE TYPE user_profile AS (user_id text);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE file_attachment AS (bucket_id text, file_path text);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 用户表
CREATE TABLE IF NOT EXISTS quality_eval_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar(50) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'student',
  display_name varchar(100),
  class_name varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);

CREATE INDEX IF NOT EXISTS idx_quality_eval_users_role ON quality_eval_users(role);
CREATE INDEX IF NOT EXISTS idx_quality_eval_users_student_id ON quality_eval_users(student_id);

-- 评价记录表
CREATE TABLE IF NOT EXISTS quality_eval_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar(50) NOT NULL UNIQUE,
  class_name varchar(100) NOT NULL,
  student_name varchar(100) NOT NULL,
  total_score numeric NOT NULL DEFAULT 0,
  eval_data jsonb NOT NULL DEFAULT '{}',
  proof_files jsonb NOT NULL DEFAULT '[]',
  review_item_status jsonb NOT NULL DEFAULT '{}',
  resubmitted boolean NOT NULL DEFAULT false,
  review_reason_status jsonb NOT NULL DEFAULT '{}',
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);

CREATE INDEX IF NOT EXISTS idx_quality_eval_student_id ON quality_eval_records(student_id);
CREATE INDEX IF NOT EXISTS idx_quality_eval_created_at ON quality_eval_records(_created_at);

-- 操作日志表
CREATE TABLE IF NOT EXISTS quality_eval_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_student_id varchar(50) NOT NULL,
  operator_name varchar(100),
  operator_role varchar(20) NOT NULL,
  operation_type varchar(50) NOT NULL,
  target_student_id varchar(50),
  target_student_name varchar(100),
  detail text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);

CREATE INDEX IF NOT EXISTS idx_quality_eval_logs_type ON quality_eval_operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_quality_eval_logs_operator ON quality_eval_operation_logs(operator_student_id);
CREATE INDEX IF NOT EXISTS idx_quality_eval_logs_created ON quality_eval_operation_logs(_created_at);

-- 设置表
CREATE TABLE IF NOT EXISTS quality_eval_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key varchar(50) NOT NULL UNIQUE,
  setting_value text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);
