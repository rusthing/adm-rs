use robotech::macros::router;

/// # 选项（字典）路由
///
/// `/adm/option` 下的一整套接口，与
/// [`AdmOptionCtrl`](crate::web::ctrl::adm_option_ctrl) 一一对应。
#[router(crud)]
struct AdmOptionRouter;
