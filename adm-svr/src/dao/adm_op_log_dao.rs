use robotech::macros::dao;

/// # 操作日志
///
/// 记录谁在什么时候对哪个接口做了什么；只增不改，用户删除受限以保证可追溯
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    like_columns: [
        Column::OpTypeCode,
        Column::OpTitle,
        Column::OpUrn,
        Column::Remark,
    ],
)]
pub struct AdmOpLogDao;
