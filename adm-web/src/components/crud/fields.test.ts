import { describe, expect, it } from "vitest";
import {
  applyFieldChange,
  defaultsOf,
  fieldKey,
  resolveFieldOptions,
  validateForm,
  visibleFieldsOf,
  type CrudField,
} from "@/components/crud/fields";

const fields: CrudField[] = [
  {
    name: "appId",
    label: "应用",
    type: "select",
    required: true,
    createOnly: true,
    options: [{ value: "a1", label: "应用一" }],
  },
  {
    name: "parentCode",
    label: "父菜单",
    type: "select",
    createOnly: true,
    resetOn: ["appId"],
    options: (values) =>
      values.appId === "a1"
        ? [{ value: "001", label: "根一" }]
        : [{ value: "002", label: "根二" }],
  },
  { name: "enabled", label: "启用", type: "switch", defaultValue: true, editOnly: true },
  { name: "name", label: "名称", required: true },
  {
    name: "mobile",
    label: "手机号",
    validate: (value) =>
      value && !/^1\d{10}$/.test(String(value)) ? "手机号格式不正确" : null,
  },
];

describe("CrudPage 表单 schema 纯逻辑", () => {
  it("按 create / edit 过滤字段，同名重名字段可用 key 区分", () => {
    expect(visibleFieldsOf(fields, "create").map((field) => field.name)).toEqual([
      "appId",
      "parentCode",
      "name",
      "mobile",
    ]);
    expect(visibleFieldsOf(fields, "edit").map((field) => field.name)).toEqual([
      "enabled",
      "name",
      "mobile",
    ]);
    expect(fieldKey(fields[0], 0)).toBe("appId-0");
    expect(fieldKey({ ...fields[0], key: "loginPswd-create" }, 0)).toBe("loginPswd-create");
  });

  it("默认值：switch 给布尔，其余给字符串", () => {
    const values = defaultsOf(fields);
    expect(values.enabled).toBe(true);
    expect(values.name).toBe("");
    expect(values.appId).toBe("");
  });

  it("动态 options 随当前表单值重算，静态 options 原样返回", () => {
    expect(resolveFieldOptions(fields[1], { appId: "a1" }, "create")).toEqual([
      { value: "001", label: "根一" },
    ]);
    expect(resolveFieldOptions(fields[1], { appId: "a2" }, "create")).toEqual([
      { value: "002", label: "根二" },
    ]);
    expect(resolveFieldOptions(fields[0], {}, "edit")).toEqual([{ value: "a1", label: "应用一" }]);
    expect(resolveFieldOptions({ name: "x", label: "x" }, {}, "create")).toEqual([]);
  });

  it("切换依赖字段时清空依赖它的字段，其它值不变", () => {
    const values = { appId: "a1", parentCode: "001", enabled: true, name: "张三" };
    expect(applyFieldChange(fields, values, "appId", "a2")).toEqual({
      ...values,
      appId: "a2",
      parentCode: "",
    });
    // 原对象不被修改
    expect(values.parentCode).toBe("001");
  });

  it("resetOn 作用在 switch 字段时清成 false 而不是空串", () => {
    const withSwitch: CrudField[] = [
      { name: "appId", label: "应用" },
      { name: "keep", label: "保持", type: "switch", resetOn: ["appId"] },
    ];
    expect(applyFieldChange(withSwitch, { keep: true }, "appId", "a2")).toEqual({
      appId: "a2",
      keep: false,
    });
  });

  it("必填与自定义校验返回第一条错误，全通过时返回 null", () => {
    expect(validateForm(fields, "create", { appId: "", parentCode: "", name: "", mobile: "" })).toBe(
      "请填写「应用」",
    );
    expect(validateForm(fields, "edit", { name: "张三", mobile: "123" })).toBe("手机号格式不正确");
    expect(validateForm(fields, "edit", { name: "张三", mobile: "13800138000" })).toBeNull();
    // createOnly 字段在编辑态不参与必填校验
    expect(validateForm(fields, "edit", { name: "张三", mobile: "" })).toBeNull();
  });
});
