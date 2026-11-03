use crate::dto::{AdmMenuAddDto, AdmMenuModifyDto, AdmMenuQueryDto};
use robotech::macros::svc;

// 排序钩子：新增按父末尾生成编码、改父重算两组、删除后同父后续前移
crate::tree_sort_hooks!(
    "adm_menu",
    Some("app_id"),
    AdmMenuAddDto,
    AdmMenuModifyDto,
    AdmMenuQueryDto,
    AdmMenuVo,
    |dto: &AdmMenuAddDto| dto.app_id.map(|value| value.value() as i64),
    |dto: &AdmMenuModifyDto| dto.app_id.map(|value| value.value() as i64),
    |dto: &AdmMenuModifyDto| dto
        .parent_code
        .as_ref()
        .map(|value| value.clone().unwrap_or_default()),
    |vo: &AdmMenuVo| Some(vo.app_id.value() as i64)
);

/// # 菜单服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（应用内皮父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点或所属应用变化时旧父下后续兄弟前移、
/// 新父下追加末位，整棵子树级联改编码；删除后同父后续兄弟前移。
///
/// 菜单树按应用隔离：`(app_id, tree_code)` 唯一，生成编码时同样按应用取最大值，
/// 两个应用互不挤占。排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmMenuSvc;
