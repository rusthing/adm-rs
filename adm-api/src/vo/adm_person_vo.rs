//! # 人员（自然人） VO
//!
//! 回答「这个人是谁」：真实姓名、拼音、身份证、联系方式，是身份主数据
//! 不记实名核验状态：核验位在 user.real_name_verified 上，一个自然人多个账号时各自独立
//! 一个自然人可以有零个或多个账号，账号侧通过 user.person_id 回指

use robotech::macros::vo;

#[vo]
pub struct AdmPersonVo {
    /// 主键
    pub id: u64,
    /// 人员编码类型 ID
    /// 关联 person_code_type；为空表示该人员没有工号/学号
    pub code_type_id: Option<u64>,
    /// 编码
    /// 工号、学号等业务编号，含义由 code_type_id 决定
    /// (code_type_id, code) 唯一（AK）
    /// @len 1..=50
    /// @check is_code
    pub code: Option<String>,
    /// 姓名
    /// 人员的真实姓名；长度 200 是为了容纳少数民族长姓名（多个间隔号拼接）
    /// @len 1..=200
    pub name: String,
    /// 姓名拼音首字母
    /// 大写、无分隔（张三 → ZS），用于快速检索
    /// @len 0..=200
    pub name_pinyin_abbr: Option<String>,
    /// 姓名拼音全拼
    /// 小写、音节间无分隔（张三 → zhangsan），用于快速检索
    /// @len 0..=200
    pub name_pinyin_full: Option<String>,
    /// 手机号（档案联系方式）
    /// 人员档案上的号码，可与账号登录手机号不同；不做唯一约束
    /// @check is_mobile_cn
    pub mobile: Option<String>,
    /// 邮箱（档案联系方式）
    /// 全局唯一（AK）：一个邮箱只对应一个人员档案
    /// @len 0..=50
    /// @check is_email
    pub email: Option<String>,
    /// 身份证号
    /// 全局唯一（AK）：同一自然人只应有一条有效档案
    /// 18 位，末位可为 X
    /// @len 18..=18
    /// @check is_id_card_cn
    pub id_card: Option<String>,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    pub enabled: bool,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
