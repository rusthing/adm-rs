use robotech::macros::svc;

/// # 人员类型服务
///
/// 字典本身没有额外业务逻辑：增删改查由框架 CRUD 生成，排序按 `value`
/// 升序由调用方指定，不维护 `sort_order`。
#[svc]
pub struct AdmPersonTypeSvc;
