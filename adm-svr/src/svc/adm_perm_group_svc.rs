use crate::dto::AdmPermGroupAddDto;
use robotech::dao::next_tree_code;
use robotech::macros::svc;
use wheel_rs::tree_utils;

/// # 权限分组服务
///
/// 框架 CRUD 之外只做一件事：**新增时生成树编码**。
///
/// 分组树按领域隔离：`(realm_id, tree_code)` 唯一，生成编码时同样按领域取最大值。
#[svc(before_add = gen_perm_group_tree_code_on_add)]
pub struct AdmPermGroupSvc;

/// # 新增时生成树编码（领域内）
///
/// `realm_id` 是必填项：缺了它不生成，让后面的校验去报「必填」，错误信息更准。
#[allow(clippy::result_large_err)]
pub async fn gen_perm_group_tree_code_on_add<C>(
    mut dto: AdmPermGroupAddDto,
    db: &C,
) -> Result<AdmPermGroupAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    if dto.tree_code.as_deref().is_some_and(|v| !v.is_empty()) {
        return Ok(dto);
    }
    let Some(realm_id) = dto.realm_id else {
        return Ok(dto);
    };
    let parent = dto.parent_code.clone().flatten().unwrap_or_default();
    let code = next_tree_code(
        db,
        "adm_perm_group",
        "tree_code",
        &parent,
        &[("realm_id", realm_id.to_db_value())],
        tree_utils::DEFAULT_STEP,
    )
    .await?;
    dto.tree_code = Some(code);
    Ok(dto)
}
