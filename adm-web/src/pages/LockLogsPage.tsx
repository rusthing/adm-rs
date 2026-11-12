import type { CrudColumn } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { UserRef, useUserName } from "@/components/ui/user-ref";
import { loadUserOptions } from "@/lib/queries";
import type { AdmLockLogVo } from "@/lib/types";

export function LockLogsPage() {
  const userName = useUserName();

  const columns: CrudColumn<AdmLockLogVo>[] = [
    { key: "lockMs", label: "锁定时间", type: "datetime", className: "whitespace-nowrap" },
    {
      key: "userId",
      label: "用户",
      className: "whitespace-nowrap",
      render: (row) => <UserRef userId={row.userId} name={userName(row.userId)} />,
    },
    {
      key: "lockReason",
      label: "锁定原因",
      truncate: true,
      truncateClassName: "max-w-[260px] max-[1400px]:max-w-[150px]",
    },
    { key: "unlockMs", label: "解锁时间", type: "datetime", className: "whitespace-nowrap" },
    {
      key: "unlockReason",
      label: "解锁原因",
      truncate: true,
      truncateClassName: "max-w-[260px] max-[1400px]:max-w-[150px]",
    },
    { key: "id", label: "日志 ID", type: "id", className: "whitespace-nowrap" },
  ];

  return (
    <CrudPage<AdmLockLogVo>
      title="锁定日志"
      subtitle="只读审计视图：登录失败触发账号锁定时写一条，到期或人工解锁后回填解锁时间与原因；解锁时间为空即仍未解锁。前端不提供新增/编辑/删除入口。"
      prefix="/adm/lock-log"
      columns={columns}
      fields={[]}
      itemLabel={(row) => row.id}
      defaultOrderBy="lock_ms:desc"
      filters={[
        { type: "keyword", placeholder: "搜索锁定 / 解锁原因" },
        { type: "date-range", name: "lock_ms", label: "锁定时间" },
        { type: "entity", name: "user_id", label: "用户", loadOptions: loadUserOptions },
      ]}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      emptyDescription="还没有锁定记录。连续登录失败触发锁定后这里会出现一条。"
      toForm={() => ({})}
      toPayload={() => ({})}
    />
  );
}
