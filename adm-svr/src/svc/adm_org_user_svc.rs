use robotech::macros::svc;

/// # 组织用户服务
///
/// 骨架阶段只有框架生成的 CRUD，业务钩子等具体场景定下来再加：
/// 钩子即边界，没有明确规则时不写「以防万一」的校验。
#[svc]
pub struct AdmOrgUserSvc;
