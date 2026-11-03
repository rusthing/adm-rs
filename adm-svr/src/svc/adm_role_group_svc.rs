use crate::dto::{AdmRoleGroupAddDto, AdmRoleGroupModifyDto};
use robotech::dao::next_tree_code;
use robotech::macros::svc;
use wheel_rs::tree_utils;

/// # 角色分组服务
///
/// 框架 CRUD 之外做两件事：**新增时生成树编码**、**修改时忽略客户端传入的树编码**。
///
/// 分组树按领域隔离：`(realm_id, tree_code)` 唯一，生成编码时同样按领域取最大值。
/// 排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[svc(
    before_add = gen_role_group_tree_code_on_add,
    before_modify = ignore_role_group_tree_code_on_modify
)]
pub struct AdmRoleGroupSvc;

/// # 新增时生成树编码（领域内）
///
/// `realm_id` 是必填项：缺了它不生成，让后面的校验去报「必填」，错误信息更准。
/// 即使客户端显式传了 `treeCode` 也忽略，统一由服务端按父节点追加到末尾。
#[allow(clippy::result_large_err)]
pub async fn gen_role_group_tree_code_on_add<C>(
    mut dto: AdmRoleGroupAddDto,
    db: &C,
) -> Result<AdmRoleGroupAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    let Some(realm_id) = dto.realm_id else {
        return Ok(dto);
    };
    let parent = dto.parent_code.clone().flatten().unwrap_or_default();
    let code = next_tree_code(
        db,
        "adm_role_group",
        "tree_code",
        &parent,
        &[("realm_id", realm_id.to_db_value())],
        tree_utils::DEFAULT_STEP,
    )
    .await?;
    dto.tree_code = Some(code);
    Ok(dto)
}

/// # 修改时忽略树编码
pub async fn ignore_role_group_tree_code_on_modify<C>(
    mut dto: AdmRoleGroupModifyDto,
    _db: &C,
) -> Result<AdmRoleGroupModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.tree_code = None;
    Ok(dto)
}
