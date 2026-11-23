use robotech::macros::dao;

/// # 人员类型
///
/// 选项值来自旧 ADM 字典 DTW_LOCATION_LOGO_TYPE 的人员项（VALUE 0-3）。
/// 人员档案只存 `value`，字典是弱引用，不建外键。
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名}_adm_person_type`），
/// 对不上会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code", "编码"),
        ("name", "名称"),
        ("value", "值"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmPersonTypeDao;
