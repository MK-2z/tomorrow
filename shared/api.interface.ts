export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

export type ReasonReviewStatus = 'pending' | 'approved' | 'needs_revision';

export type EvalReasonType = 'positive' | 'negative' | 'custom';

export interface ProofFile {
  id: string;
  name: string;
  url: string;
  reasonId: string;
}

export interface EvalReason {
  id: string;
  reason: string;
  score: number;
  type: EvalReasonType;
  projectName?: string;
  levelName?: string;
  projectKey?: string;
  levelKey?: string;
  optionKey?: string;
  optionName?: string;
  remark?: string;
  needProof?: boolean;
  isCustom?: boolean;
  isPendingReview?: boolean;
  count?: number;
  proofFiles: ProofFile[];
  reviewStatus?: ReasonReviewStatus;
  reviewComment?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
}

export interface EvalItem {
  itemKey: string;
  itemName: string;
  itemScore: number;
  itemMaxScore?: number;
  reasons: EvalReason[];
}

export interface EvalCategory {
  categoryKey: string;
  categoryName: string;
  categoryScore: number;
  categoryMaxScore?: number;
  isExtra?: boolean;
  items: EvalItem[];
}

export interface QualityEvalRecord {
  id: string;
  studentId: string;
  className: string;
  studentName: string;
  totalScore: number;
  qualityScore: number;
  academicScore: number | null;
  comprehensiveScore: number | null;
  categories: EvalCategory[];
  reviewStatus: ReviewStatus;
  reviewComment?: string;
  reviewAt?: string;
  reviewBy?: string;
  reviewItemStatus: Record<string, ItemReviewState>;
  resubmitted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQualityEvalDto {
  studentId: string;
  className: string;
  studentName: string;
  totalScore: number;
  qualityScore: number;
  academicScore?: number;
  comprehensiveScore?: number;
  categories: EvalCategory[];
}

export interface UpdateQualityEvalDto {
  studentId?: string;
  className?: string;
  studentName?: string;
  totalScore?: number;
  qualityScore?: number;
  academicScore?: number;
  comprehensiveScore?: number;
  categories?: EvalCategory[];
}

export interface ReviewQualityEvalDto {
  status: ReviewStatus;
  comment?: string;
}

export type ItemReviewStatus = 'pending' | 'approved' | 'needs_revision';

export interface ItemReviewState {
  status: ItemReviewStatus;
  comment?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  autoApproved?: boolean;
}

export interface ReviewItemDto {
  itemKey: string;
  status: ItemReviewStatus;
  comment?: string;
}

export interface ReviewReasonDto {
  reasonId: string;
  itemKey: string;
  status: ReasonReviewStatus;
  comment?: string;
}

export interface FillTimeSettings {
  mode: 'always' | 'specified';
  start: string;
  end: string;
}

export interface FillTimeSettingsDto {
  mode: 'always' | 'specified';
  start?: string;
  end?: string;
}

export interface QualityEvalListStats {
  all: number;
  pending: number;
  approved: number;
  returned: number;
}

export interface QualityEvalListResponse {
  items: QualityEvalRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats?: QualityEvalListStats;
}

export interface QualityEvalDetailResponse {
  data: QualityEvalRecord | null;
}

// 旧版扁平结构类型（兼容保留）
export interface ScoringRuleLevel {
  levelName: string;
  score: number;
}

export interface ScoringRule {
  categoryKey: string;
  categoryName: string;
  itemKey: string;
  itemName: string;
  itemMaxScore: number;
  type: 'positive' | 'negative';
  projectName: string;
  levels: ScoringRuleLevel[];
  remark: string;
  needProof: boolean;
}

// 新版三级联动结构类型
export interface ScoringRuleOption {
  optionKey: string;
  optionName: string;
  score: number;
  needProof: boolean;
}

export interface ScoringRuleLevelGroup {
  levelKey: string;
  levelName: string;
  options: ScoringRuleOption[];
}

export interface ScoringRuleProject {
  projectKey: string;
  projectName: string;
  remark: string;
  type: 'positive' | 'negative' | 'custom';
  isCustom?: boolean;
  repeatable?: boolean;
  levelGroups: ScoringRuleLevelGroup[];
}

export interface ScoringRuleItem {
  itemKey: string;
  itemName: string;
  itemMaxScore: number;
  type: 'positive' | 'negative';
  projects: ScoringRuleProject[];
}

export interface ReviewCheckResult {
  reasonId: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
}

export interface ReviewCheckSummary {
  total: number;
  pass: number;
  warning: number;
  error: number;
  results: ReviewCheckResult[];
}

export type UserRole = 'student' | 'admin' | 'super_admin';

export interface QualityEvalUser {
  id: string;
  studentId: string;
  role: UserRole;
  displayName?: string;
  className?: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  studentId: string;
  password: string;
}

export interface LoginResponse {
  user: QualityEvalUser;
  token: string;
}

export interface OperationLog {
  id: string;
  operatorStudentId: string;
  operatorName?: string;
  operatorRole: UserRole;
  operationType: string;
  targetStudentId?: string;
  targetStudentName?: string;
  detail?: string;
  createdAt: string;
}

export interface OperationLogListResponse {
  items: OperationLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserListResponse {
  items: QualityEvalUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserDto {
  studentId: string;
  password: string;
  displayName?: string;
  className?: string;
  role: UserRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
}
