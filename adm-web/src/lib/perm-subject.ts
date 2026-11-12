/**
 * 权限主体字典。
 *
 * `adm_perm.subject_code` 记录权限作用在哪个业务对象上（用户 / 人员 / 组织 ...），
 * 取值是**闭集**，由种子数据里的权限分组第三层固定下来；库里没有对应的字典表，
 * 所以这里维护一份与 `init-data.sql` 完全一致的清单，新增主体时两处一起改。
 *
 * 权限名称只描述动作（「按 ID 删除」），主体和操作类型分别由本字典与 `op_type` 表达。
 */
export interface PermSubjectOption {
  /** 与 `adm_perm.subject_code` 一致 */
  value: string;
  /** 中文主体名，与权限分组第三层同名 */
  label: string;
  /** 所属菜单一级，便于在表单里分组展示 */
  section: string;
}

export const PERM_SUBJECTS: PermSubjectOption[] = [
  { value: "org", label: "组织", section: "组织与人员" },
  { value: "org_type", label: "组织类型", section: "组织与人员" },
  { value: "org_user", label: "组织成员", section: "组织与人员" },
  { value: "person", label: "人员", section: "组织与人员" },
  { value: "person_code_type", label: "人员编码类型", section: "组织与人员" },
  { value: "user", label: "用户", section: "组织与人员" },
  { value: "role_group", label: "角色分组", section: "角色与授权" },
  { value: "role", label: "角色", section: "角色与授权" },
  { value: "perm_group", label: "权限分组", section: "角色与授权" },
  { value: "perm", label: "权限", section: "角色与授权" },
  { value: "menu", label: "菜单", section: "角色与授权" },
  { value: "menu_perm", label: "菜单绑定", section: "角色与授权" },
  { value: "role_menu", label: "角色菜单", section: "角色与授权" },
  { value: "role_perm", label: "角色权限", section: "角色与授权" },
  { value: "role_user", label: "角色用户", section: "角色与授权" },
  { value: "realm", label: "领域", section: "系统配置" },
  { value: "realm_user", label: "领域成员", section: "系统配置" },
  { value: "realm_org", label: "领域组织", section: "系统配置" },
  { value: "app", label: "应用", section: "系统配置" },
  { value: "op_type", label: "操作类型", section: "系统配置" },
  { value: "option", label: "选项", section: "系统配置" },
  { value: "dashboard", label: "首页配置", section: "系统配置" },
  { value: "widget_data", label: "widget 数据", section: "系统配置" },
  { value: "login_log", label: "登录日志", section: "审计日志" },
  { value: "op_log", label: "操作日志", section: "审计日志" },
  { value: "lock_log", label: "锁定日志", section: "审计日志" },
];

const BY_VALUE = new Map(PERM_SUBJECTS.map((item) => [item.value, item]));

/** 主体编码 → 中文名；未知编码原样返回，避免界面出现空白单元格。 */
export function subjectLabel(code: string | undefined): string {
  if (!code) return "";
  return BY_VALUE.get(code)?.label ?? code;
}

/** 权限分组第三层（主体）的 treeCode 长度：3 层 × 每层 3 位。 */
export const SUBJECT_TREE_LEN = 9;

/** 取分组所属主体的 treeCode；分组层级不足 3 层时退回自身。 */
export function subjectTreeCode(treeCode: string): string {
  return treeCode.length <= SUBJECT_TREE_LEN ? treeCode : treeCode.slice(0, SUBJECT_TREE_LEN);
}

/** 中文主体名 → 编码；用于从分组名反查主体（分组第三层与主体同名）。 */
export function subjectCodeByLabel(label: string): string | undefined {
  return PERM_SUBJECTS.find((item) => item.label === label)?.value;
}
