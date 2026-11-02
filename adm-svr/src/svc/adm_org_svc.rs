use crate::dto::AdmOrgAddDto;
use robotech::dao::next_tree_code;
use robotech::macros::svc;
use wheel_rs::tree_utils;

/// # 组织服务
///
/// 框架 CRUD 之外只做一件事：**新增时生成树编码**。
///
/// 新增请求带 `parentCode`（根节点不带），服务端算出该父下下一个可用编码；
/// 显式传了 `treeCode` 的（导入/预置数据）原样落库。组织树全局一棵，没有隔离条件。
///
/// 移动节点 = 改编码，会级联整棵子树，暂不提供接口；真要做也是在这里挂钩子。
#[svc(before_add = gen_org_tree_code_on_add)]
pub struct AdmOrgSvc;

/// # 新增时生成树编码
///
/// 钩子在事务里、校验之前执行，生成的编码仍要过 `@len`/`@check`。
/// 两个请求同时挂到同一父节点可能算出同一个编码，其中一个会撞
/// `ak_tree_code_adm_org` 唯一约束，由 DAO 翻译成「已存在」，调用方重试即可。
#[allow(clippy::result_large_err)]
pub async fn gen_org_tree_code_on_add<C>(
    mut dto: AdmOrgAddDto,
    db: &C,
) -> Result<AdmOrgAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    // 显式给了编码就不生成（导入/预置数据走这条路），传空串当没传
    if dto.tree_code.as_deref().is_some_and(|v| !v.is_empty()) {
        return Ok(dto);
    }
    let parent = dto.parent_code.clone().flatten().unwrap_or_default();
    let code = next_tree_code(
        db,
        "adm_org",
        "tree_code",
        &parent,
        &[],
        tree_utils::DEFAULT_STEP,
    )
    .await?;
    dto.tree_code = Some(code);
    Ok(dto)
}
