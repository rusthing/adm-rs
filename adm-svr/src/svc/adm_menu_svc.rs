use crate::dto::AdmMenuAddDto;
use robotech::dao::next_tree_code;
use robotech::macros::svc;
use wheel_rs::tree_utils;

/// # 菜单服务
///
/// 框架 CRUD 之外只做一件事：**新增时生成树编码**。
///
/// 菜单树按应用隔离：`(app_id, tree_code)` 唯一，生成编码时同样按应用取最大值，
/// 两个应用互不挤占。
#[svc(before_add = gen_menu_tree_code_on_add)]
pub struct AdmMenuSvc;

/// # 新增时生成树编码（应用内）
///
/// `app_id` 是必填项：缺了它不生成，让后面的校验去报「必填」，错误信息更准。
#[allow(clippy::result_large_err)]
pub async fn gen_menu_tree_code_on_add<C>(
    mut dto: AdmMenuAddDto,
    db: &C,
) -> Result<AdmMenuAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    if dto.tree_code.as_deref().is_some_and(|v| !v.is_empty()) {
        return Ok(dto);
    }
    // 缺必填：不生成，交给校验层报告
    let Some(app_id) = dto.app_id else {
        return Ok(dto);
    };
    let parent = dto.parent_code.clone().flatten().unwrap_or_default();
    let code = next_tree_code(
        db,
        "adm_menu",
        "tree_code",
        &parent,
        &[("app_id", app_id.to_db_value())],
        tree_utils::DEFAULT_STEP,
    )
    .await?;
    dto.tree_code = Some(code);
    Ok(dto)
}
