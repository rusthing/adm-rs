//! # 用户（账号） VO
//!
//! 回答「哪个标识能登进哪个账号」：登录名、登录用手机/邮箱、实名信息（姓名 + 身份证）、三套密码、状态
//! 实名信息与核验位放在本表：登录时的实名校验以账号为单位，person 只存人员档案、不记核验状态
//!
//! 三套口令与盐值不进 VO：口令只进不出，前端拿不到就不会渲染到页面上。

use robotech::macros::vo;

#[vo]
pub struct AdmUserVo {
    /// 主键
    pub id: u64,
    /// 人员 ID
    /// 关联 person，一个自然人可挂多个账号
    /// 为空表示纯账号（外部认证、系统账号、机器人），不关联人员档案
    pub person_id: Option<u64>,
    /// 登录名
    /// 登录时输入的唯一标识，全局唯一（AK）；手机号另有唯一约束（见 mobile），邮箱没有
    /// 4~32 位，字母开头，只含字母、数字、下划线
    /// @len 4..=32
    /// @check is_account_name
    pub name: String,
    /// 昵称
    /// 展示用，允许重复，不做唯一约束
    /// @len 0..=50
    pub nick_name: Option<String>,
    /// 手机号（登录用）
    /// 全局唯一（AK）：一个手机号只能定位一个账号
    /// 与 person.mobile 的语义不同，后者是人员档案上的联系方式
    /// 入库前请去掉 +86 与分隔符
    /// @len 11..=11
    /// @check is_mobile_cn
    pub mobile: Option<String>,
    /// 手机号是否已验证
    /// true 表示该手机号通过短信验证码校验；注册后未验证也能登录，但改密/支付等敏感操作要求已验
    /// 未验证记 false，不用 NULL：三态的「不知道是否验证过」没有业务含义
    pub mobile_verified: bool,
    /// 邮箱（登录用）
    /// 全局唯一（AK）：一个邮箱只能定位到一个账号，可用于邮箱登录与找回密码
    /// 与 person.email 的语义不同，后者是人员档案上的联系方式，两者各自唯一、互不覆盖
    /// @len 0..=50
    /// @check is_email
    pub email: Option<String>,
    /// 邮箱是否已验证
    /// true 表示该邮箱通过验证链接校验，可用于找回密码与接收通知
    /// 未验证记 false，不用 NULL：三态没有业务含义
    pub email_verified: bool,
    /// 身份证号（登录实名用）
    /// 可空：手机号注册的账号可以先不填；一经填写就全局唯一（AK），一个身份证只能绑一个账号
    /// 空值不参与唯一去重（PostgreSQL 的 AK 不约束 NULL），所以「未实名的账号」不会互相冲突
    /// 人员档案上的同一份数据见 person.id_card，由实名核验流程保证一致
    /// 18 位，末位可为 X
    /// @len 18..=18
    /// @check is_id_card_cn
    pub id_card: Option<String>,
    /// 真实姓名（登录实名用）
    /// 可空：与 id_card 配对，未实名的账号两列都为空；填了一列就必须填另一列
    /// 与 person.name 是同一份事实的两处记录，实名核验流程在一个事务里同时写两处，不要只写一边
    /// 长度 200 与 person.name 对齐，容纳少数民族长姓名；不挂 is_chinese_name：外籍与少数民族姓名允许非汉字
    /// @len 1..=200
    pub real_name: Option<String>,
    /// 是否已验证实名
    /// true 表示姓名（real_name）与身份证号（id_card）这一组已通过实名核验
    /// 核验对象是两列的组合，单独一列没有意义：real_name / id_card 未填时本列只能为 false
    /// 登录时若要求「实名后才能操作」，判这一列
    pub real_name_verified: bool,
    /// 过期时间戳
    /// 账户到期时间；定时任务扫描到已过期时把 enabled 置 false
    /// 与 status 的区别：status 是人工停用与锁定判定，expire_ms 是到期自动停用
    /// @unit ms
    pub expire_ms: Option<u64>,
    /// 状态
    /// 1-正常
    /// 2-已停用
    /// 3-已锁定
    /// 与 enabled 的关系：enabled=false 时账号整体不可登录，status 用于展示与锁定判定
    /// @range 1..=3
    pub status: i16,
    /// 登录失败次数
    /// 登录成功后清零；达到阈值时把 status 置 3 并写入 lock_until_ms
    /// @range 0..=100
    pub fail_count: i16,
    /// 锁定到期时间戳
    /// 为空或已过期表示未锁定；解锁时置空并把 status 恢复为 1
    /// @unit ms
    pub lock_until_ms: Option<u64>,
    /// 最近登录时间戳
    /// 只记录成功登录，失败尝试见 login_log
    /// @unit ms
    pub last_login_ms: Option<u64>,
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
