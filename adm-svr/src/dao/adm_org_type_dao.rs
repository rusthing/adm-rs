use robotech::macros::dao;

/// # 组织类型
///
/// 有GROUP(集团)、UNIT(政府单位)、CORP(公司)、MILITARY(军)、DEPT(部门)、BRANCH_FACTORY(分厂)、DIRECTLY_BRIGADE(直属旅)、BRIGADE(旅)、TEAM(小组)、CLASSES(班级)等
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
pub struct AdmOrgTypeDao;
