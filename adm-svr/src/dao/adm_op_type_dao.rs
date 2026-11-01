use robotech::macros::dao;

/// # 操作类型
///
/// 初始有查看(Read)、 添加(Create)、修改(Update)、删除(Delete)、登录(Login)、登出(Logout)、导入(Import)、导出(Export)
///
/// 、上传(Upload)、下载(Download)、审核(Audit)、授权(Assign)、打印(Print)这些类型
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code", "编码"),
        ("name", "名称"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmOpTypeDao;
