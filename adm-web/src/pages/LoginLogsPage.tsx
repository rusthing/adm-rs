import type { CrudColumn } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { loadUserOptions } from "@/lib/queries";
import type { AdmLoginLogVo } from "@/lib/types";

function duration(row: AdmLoginLogVo): string {
  if (!row.logoutMs) return "进行中";
  const start = Number(row.loginMs);
  const end = Number(row.logoutMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= 0) return "--";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

const columns: CrudColumn<AdmLoginLogVo>[] = [
  { key: "loginMs", label: "登录时间", type: "datetime" },
  { key: "logoutMs", label: "登出时间", type: "datetime" },
  { key: "duration", label: "会话时长", render: (row) => <span className="text-[11.5px]">{duration(row)}</span> },
  { key: "userId", label: "用户 ID", type: "id" },
  { key: "loginIp", label: "登录 IP", type: "code" },
  { key: "id", label: "日志 ID", type: "id" },
];

export function LoginLogsPage() {
  return (
    <CrudPage<AdmLoginLogVo>
      title="登录日志"
      subtitle="只读审计视图：登录成功时写一条，登出时回填 logoutMs。前端不提供新增/编辑/删除入口。"
      prefix="/adm/login-log"
      columns={columns}
      fields={[]}
      itemLabel={(row) => row.id}
      defaultOrderBy="login_ms:desc"
      filters={[
        { type: "keyword", placeholder: "搜索登录 IP" },
        { type: "date-range", name: "login_ms", label: "登录时间" },
        { type: "entity", name: "user_id", label: "用户", loadOptions: loadUserOptions },
      ]}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      emptyDescription="还没有登录记录。登录一次后这里会出现一条。"
      toForm={() => ({})}
      toPayload={() => ({})}
    />
  );
}
