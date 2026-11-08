import { useMemo } from "react";
import type { CrudColumn } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { opTypeApi } from "@/lib/api";
import { loadUserOptions, useOpTypeOptions } from "@/lib/queries";
import type { AdmOpLogVo } from "@/lib/types";

/** 操作类型筛选：与展示列共用同一份字典，避免下拉和表格出现两套文案。 */
async function loadOpTypeOptions() {
  const list = await opTypeApi.list({ _orderBy: "sort_order:asc" });
  return list.map((item) => ({ value: item.code, label: item.name }));
}

export function OpLogsPage() {
  const opTypesQuery = useOpTypeOptions();

  const opTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of opTypesQuery.data ?? []) map.set(item.code, item.name);
    return map;
  }, [opTypesQuery.data]);

  const columns: CrudColumn<AdmOpLogVo>[] = [
    { key: "createMs", label: "操作时间", type: "datetime", className: "whitespace-nowrap" },
    { key: "userId", label: "用户", type: "id", className: "whitespace-nowrap" },
    {
      key: "opTypeCode",
      label: "类型",
      className: "whitespace-nowrap",
      render: (row) => {
        const name = opTypeName.get(row.opTypeCode);
        return <span title={`${name ?? row.opTypeCode}（${row.opTypeCode}）`}>{name ?? row.opTypeCode}</span>;
      },
    },
    {
      key: "opTitle",
      label: "操作",
      truncate: true,
      truncateClassName: "max-w-[240px] max-[1400px]:max-w-[140px]",
    },
    {
      key: "opUrn",
      label: "接口",
      type: "code",
      truncate: true,
      truncateClassName: "max-w-[240px] max-[1400px]:max-w-[140px]",
    },
    {
      key: "remark",
      label: "备注",
      truncate: true,
      truncateClassName: "max-w-[240px] max-[1400px]:max-w-[140px]",
    },
    { key: "id", label: "日志 ID", type: "id", className: "whitespace-nowrap" },
  ];

  return (
    <CrudPage<AdmOpLogVo>
      title="操作日志"
      subtitle="只读审计视图：由服务端在写操作后统一落库，记录谁在什么时候调用了哪个接口。前端不提供新增/编辑/删除入口。"
      prefix="/adm/op-log"
      columns={columns}
      fields={[]}
      itemLabel={(row) => row.id}
      defaultOrderBy="create_ms:desc"
      filters={[
        { type: "keyword", placeholder: "搜索操作标题 / 接口 / 备注" },
        { type: "date-range", name: "create_ms", label: "操作时间" },
        { type: "entity", name: "op_type_code", label: "类型", loadOptions: loadOpTypeOptions },
        { type: "entity", name: "user_id", label: "用户", loadOptions: loadUserOptions },
      ]}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      emptyDescription="还没有操作记录。完成一次新增 / 修改 / 删除后这里会出现一条。"
      toForm={() => ({})}
      toPayload={() => ({})}
    />
  );
}
