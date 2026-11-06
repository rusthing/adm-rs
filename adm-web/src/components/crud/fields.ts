/**
 * CrudPage 表单 schema 的纯逻辑：字段可见性、默认值、动态选项、联动清空与校验。
 *
 * 与渲染分离后这部分可以直接单测，CrudPage 只负责把结果画出来。
 */
import type { FormValues } from "@/lib/types";

export type FormMode = "create" | "edit";

export interface CrudFieldOption {
  value: string;
  label: string;
}

export interface CrudField {
  name: string;
  /** 渲染用的唯一键；同一 name 在 createOnly / editOnly 各出现一次时必须区分。 */
  key?: string;
  label: string;
  type?: "text" | "textarea" | "switch" | "select" | "password" | "number";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** 静态选项，或按当前表单值动态计算（父菜单按 appId 过滤等）。 */
  options?: CrudFieldOption[] | ((values: FormValues, mode: FormMode) => CrudFieldOption[]);
  /** 自定义校验：返回错误文案，null 表示通过。 */
  validate?: (value: FormValues[string], values: FormValues, mode: FormMode) => string | null;
  /** 列出的字段变化时清空本字段，避免留下跨应用的失效引用。 */
  resetOn?: string[];
  span?: 2;
  createOnly?: boolean;
  editOnly?: boolean;
  defaultValue?: string | boolean;
  disabled?: boolean;
}

export function fieldKey(field: CrudField, index: number): string {
  return field.key ?? `${field.name}-${index}`;
}

export function visibleFieldsOf(fields: CrudField[], mode: FormMode): CrudField[] {
  return fields.filter((field) => {
    if (field.createOnly && mode !== "create") return false;
    if (field.editOnly && mode !== "edit") return false;
    return true;
  });
}

export function defaultsOf(fields: CrudField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.type === "switch") values[field.name] = Boolean(field.defaultValue);
    else values[field.name] = field.defaultValue === undefined ? "" : String(field.defaultValue);
  }
  return values;
}

/** 动态 options 每次渲染按当前表单值重算，父节点下拉据此过滤。 */
export function resolveFieldOptions(
  field: CrudField,
  values: FormValues,
  mode: FormMode,
): CrudFieldOption[] {
  return typeof field.options === "function" ? field.options(values, mode) : (field.options ?? []);
}

/**
 * 更新一个字段，并清空所有声明了 resetOn 的依赖字段。
 * 例如切换「所属应用」后，父节点里残留的另一应用 treeCode 必须清掉。
 */
export function applyFieldChange(
  fields: CrudField[],
  values: FormValues,
  name: string,
  value: FormValues[string],
): FormValues {
  const next: FormValues = { ...values, [name]: value };
  for (const field of fields) {
    if (field.resetOn?.includes(name)) next[field.name] = field.type === "switch" ? false : "";
  }
  return next;
}

/** 必填 + 自定义校验；返回第一条错误文案，全部通过时返回 null。 */
export function validateForm(fields: CrudField[], mode: FormMode, values: FormValues): string | null {
  for (const field of visibleFieldsOf(fields, mode)) {
    const value = values[field.name];
    if (field.required) {
      if (typeof value === "string" && !value.trim()) return `请填写「${field.label}」`;
      if (value === undefined || value === "") return `请填写「${field.label}」`;
    }
    if (field.validate) {
      const error = field.validate(value, values, mode);
      if (error) return error;
    }
  }
  return null;
}
