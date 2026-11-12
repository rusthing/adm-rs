import { useMemo } from "react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmPersonVo, FormValues } from "@/lib/types";
import { usePersonCodeTypeOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

/** 身份证只露前 6 后 4：列表是高频扫视的页面，没必要把完整证件号摆在屏幕上。 */
function maskIdCard(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}****`;
  return `${value.slice(0, 6)}********${value.slice(-4)}`;
}

/**
 * 人员是「自然人」主数据（姓名 / 证件 / 联系方式），一个自然人可以有零个或多个账号；
 * 账号在「用户管理」里建，通过 user.person_id 回指。编码取决于所选的编码类型（工号 / 学号）。
 */
export function PersonsPage() {
  const codeTypesQuery = usePersonCodeTypeOptions();

  const codeTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of codeTypesQuery.data ?? []) map.set(type.id, type.name);
    return map;
  }, [codeTypesQuery.data]);

  const columns: CrudColumn<AdmPersonVo>[] = [
    {
      key: "name",
      label: "姓名",
      className: "whitespace-nowrap",
      render: (row) => (
        <span className="font-medium text-ink" title="列表返回的是服务端遮蔽值，编辑时回显完整姓名">
          {row.name}
        </span>
      ),
    },
    {
      key: "code",
      label: "编码",
      className: "whitespace-nowrap",
      render: (row) => {
        if (!row.code) return <span className="text-muted">—</span>;
        const type = row.codeTypeId ? codeTypeName.get(row.codeTypeId) : undefined;
        return (
          <span className="inline-flex items-baseline gap-1.5">
            <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code>
            <span className="text-[10.5px] text-muted">{type ?? (row.codeTypeId ? shortId(row.codeTypeId) : "无类型")}</span>
          </span>
        );
      },
    },
    { key: "mobile", label: "手机", className: "whitespace-nowrap" },
    { key: "email", label: "邮箱", truncate: true, truncateClassName: "max-w-[200px]" },
    {
      key: "idCard",
      label: "身份证",
      className: "whitespace-nowrap",
      render: (row) =>
        row.idCard ? (
          <code className="font-mono text-[11px] text-ink-soft" title="列表脱敏展示，编辑时会回显完整值">
            {maskIdCard(row.idCard)}
          </code>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "remark", label: "备注", truncate: true },
    { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
  ];

  const fields: CrudField[] = [
    { name: "name", label: "姓名", required: true, placeholder: "真实姓名，可用间隔号连接长姓名" },
    {
      name: "codeTypeId",
      label: "编码类型",
      type: "select",
      options: (codeTypesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
      hint: codeTypesQuery.data?.length
        ? "决定下面的编码是工号还是学号；同一类型下编码唯一。"
        : "还没有编码类型，可先到「人员编码类型」建一个。",
    },
    {
      name: "code",
      label: "编码",
      placeholder: "工号 / 学号，选了类型才填",
      hint: "与编码类型组成唯一键；没有工号的人员可以留空。",
    },
    { name: "mobile", label: "手机", placeholder: "档案联系方式，可与登录手机号不同" },
    { name: "email", label: "邮箱", placeholder: "全局唯一，一个邮箱对应一个人员" },
    { name: "idCard", label: "身份证", placeholder: "18 位，末位可为 X", hint: "全局唯一；列表里脱敏展示。" },
    {
      name: "namePinyinAbbr",
      label: "拼音首字母",
      placeholder: "ZS",
      hint: "可选，大写无分隔，用于拼音首字母检索。",
    },
    {
      name: "namePinyinFull",
      label: "拼音全拼",
      placeholder: "zhangsan",
      hint: "可选，小写无分隔，用于拼音检索。",
    },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmPersonVo): FormValues => ({
    name: row.name,
    codeTypeId: row.codeTypeId ?? "",
    code: row.code ?? "",
    mobile: row.mobile ?? "",
    email: row.email ?? "",
    idCard: row.idCard ?? "",
    namePinyinAbbr: row.namePinyinAbbr ?? "",
    namePinyinFull: row.namePinyinFull ?? "",
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    name: String(values.name ?? "").trim(),
    codeTypeId: optionalText(values.codeTypeId),
    code: optionalText(values.code),
    mobile: optionalText(values.mobile),
    email: optionalText(values.email),
    idCard: optionalText(values.idCard),
    namePinyinAbbr: optionalText(values.namePinyinAbbr),
    namePinyinFull: optionalText(values.namePinyinFull),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPersonVo>
      title="人员管理"
      subtitle="人员是自然人主数据（姓名 / 证件 / 联系方式），本身不能登录；登录账号在「用户管理」里建并回指人员。编码的含义由编码类型决定（工号 / 学号），没有工号的人员可以不选类型。列表对姓名 / 手机 / 邮箱 / 身份证做等长遮蔽，拼音两列只参与检索、不在列表展示——否则遮蔽就白做了。"
      prefix="/adm/person"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="update_ms:desc"
      searchPlaceholder="搜索姓名 / 编码 / 手机 / 邮箱 / 拼音"
      filters={[
        {
          type: "entity",
          name: "code_type_id",
          label: "编码类型",
          options: (codeTypesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
        },
        { type: "boolean", name: "enabled", label: "启用" },
        { type: "date-range", name: "create_ms", label: "创建时间" },
      ]}
      createLabel="新建人员"
      emptyDescription="还没有人员档案。先录人员，再在「用户管理」里给他建登录账号。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
