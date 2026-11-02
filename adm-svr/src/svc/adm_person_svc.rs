use robotech::macros::svc;

/// # 人员（自然人）服务
///
/// 骨架阶段只有框架生成的 CRUD，业务钩子等具体场景定下来再加：
/// 钩子即边界，没有明确规则时不写「以防万一」的校验。
///
/// 批量查询返回 `AdmPersonListVo`：姓名、手机号、邮箱、身份证四个可定位
/// 个人的字段只出遮蔽结果；单条详情继续用 `AdmPersonVo` 回显原值。
#[svc(list_vo = AdmPersonListVo)]
pub struct AdmPersonSvc;
