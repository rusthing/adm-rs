use robotech::macros::api_doc;

/// # 登录日志接口文档（只读）
///
/// 只暴露查询接口，不提供新增 / 修改 / 删除，Swagger 地址：`/adm/login-log/openapi.json`
#[api_doc(
    get_by_id,
    get_ex_by_id,
    get_by_query_dto,
    get_ex_by_query_dto,
    list_by_query_dto,
    list_ex_by_query_dto,
    page_by_query_dto,
    page_ex_by_query_dto,
    search_by_id,
    search_by_condition,
    search_list,
    search_page,
    search_ex_by_id,
    search_ex_by_condition,
    search_list_ex,
    search_page_ex,
)]
pub struct AdmLoginLogApiDoc;
