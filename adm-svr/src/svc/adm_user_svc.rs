//! # 用户服务
//!
//! 用户是唯一涉及口令的实体，业务逻辑集中在三个地方：
//!
//! * **口令摘要**：新增必须给口令，落库前加盐摘要；修改时留空表示「不改口令」，
//!   避免改个昵称也要把口令重打一遍。
//! * **角色校验**：`role_id` 是外键，提前确认角色存在，把外键错误换成可读提示。
//! * **账号规整**：账号与昵称去掉首尾空白。
//!
//! 口令只进不出：VO 里没有 `password`，所以检测、登录这类需要摘要的路径读实体，
//! 不走 VO。

use crate::config::get_adm_config;
use crate::dao::AdmRoleDao;
use crate::utils::AdmPasswordUtils;
use anyhow::anyhow;
use robotech::db::get_db_conn;
use robotech::macros::svc;
use sea_orm::DatabaseConnection;
use wheel_rs::time_utils::now_ms;

#[svc(
    before_add = AdmUserSvc::before_add_hook,
    before_modify = AdmUserSvc::before_modify_hook
)]
pub struct AdmUserSvc;

// SvcError 由框架定义且体积较大，而钩子的返回类型必须与宏约定一致
#[allow(clippy::result_large_err)]
impl AdmUserSvc {
    /// # 新增前钩子：规整账号、摘要口令、校验角色
    async fn before_add_hook<C: ConnectionTrait>(
        mut add_dto: AdmUserAddDto,
        _db: &C,
    ) -> Result<AdmUserAddDto, SvcError> {
        add_dto.username = Some(Self::trim_required(
            add_dto.username.as_deref(),
            "登录账号",
        )?);
        add_dto.nickname = Some(Self::trim_required(add_dto.nickname.as_deref(), "昵称")?);
        // 可空列在 AddDto 里是 Option<Option<String>>，读写都要拆一层
        if let Some(remark) = add_dto.remark.clone().flatten() {
            add_dto.remark = Some(Some(remark.trim().to_string()));
        }

        // 新增必须给口令：库里这一列可空（外部认证用户），但不能由接口留空进来
        let raw = add_dto
            .password
            .clone()
            .flatten()
            .unwrap_or_default()
            .trim()
            .to_string();
        if raw.is_empty() {
            return Err(anyhow!("新增用户必须设置登录口令").into());
        }
        add_dto.password = Some(Some(Self::hash_password(&raw)?));

        if let Some(role_id) = add_dto.role_id {
            Self::ensure_role_exists(role_id).await?;
        }
        Ok(add_dto)
    }

    /// # 修改前钩子：口令留空表示不修改，其余同新增
    async fn before_modify_hook<C: ConnectionTrait>(
        mut modify_dto: AdmUserModifyDto,
        _db: &C,
    ) -> Result<AdmUserModifyDto, SvcError> {
        if modify_dto.username.is_some() {
            modify_dto.username = Some(Self::trim_required(
                modify_dto.username.as_deref(),
                "登录账号",
            )?);
        }
        if modify_dto.nickname.is_some() {
            modify_dto.nickname =
                Some(Self::trim_required(modify_dto.nickname.as_deref(), "昵称")?);
        }
        if let Some(remark) = modify_dto.remark.clone().flatten() {
            modify_dto.remark = Some(Some(remark.trim().to_string()));
        }

        // 口令留空表示「沿用旧口令」：字段是 Option<Option<String>>，
        // 置成 None 才会让 ActiveModel 走 NotSet 而不是 Set(NULL)
        let raw = modify_dto
            .password
            .clone()
            .flatten()
            .unwrap_or_default()
            .trim()
            .to_string();
        if raw.is_empty() {
            modify_dto.password = None;
        } else {
            modify_dto.password = Some(Some(Self::hash_password(&raw)?));
        }

        if let Some(role_id) = modify_dto.role_id {
            Self::ensure_role_exists(role_id).await?;
        }
        Ok(modify_dto)
    }

    /// # 把口令重置为配置里的默认值
    ///
    /// 管理端的「重置口令」按钮走这里：不接收新口令，只把库里换成一个已知的默认值，
    /// 再要求用户下次登录时自行修改。这样管理员不需要知道用户的新口令。
    ///
    /// ## 参数
    /// * `id` - 用户ID
    ///
    /// ## 返回值
    /// * `Ok(Ro<()>)` - 重置成功
    /// * `Err(SvcError)` - 用户不存在或写库失败
    #[log_call]
    pub async fn reset_password(id: U64) -> Result<Ro<()>, SvcError> {
        let config = get_adm_config().map_err(|e| anyhow!("获取业务配置失败: {e}"))?;
        let hashed = AdmPasswordUtils::hash(&config.password_salt, &config.default_password);

        let mut modify_dto = AdmUserModifyDto::builder()
            .id(id)
            ._current_user_id(U64(1))
            ._current_ms(U64(now_ms()))
            .build();
        // 直接赋值：字段是 Option<Option<String>>，Some(Some(..)) 才是「写入新摘要」
        modify_dto.password = Some(Some(hashed));

        Self::modify::<DatabaseConnection>(modify_dto, None).await?;
        Ok(Ro::success("口令已重置为默认值".to_string()))
    }

    /// # 按配置的盐值计算口令摘要
    fn hash_password(raw: &str) -> Result<String, anyhow::Error> {
        let config = get_adm_config().map_err(|e| anyhow!("获取业务配置失败: {e}"))?;
        Ok(AdmPasswordUtils::hash(&config.password_salt, raw))
    }

    /// # 确认角色存在
    ///
    /// ## 参数
    /// * `role_id` - 角色ID
    ///
    /// ## 返回值
    /// * `Ok(())` - 角色存在
    /// * `Err(SvcError)` - 角色不存在或读库失败
    async fn ensure_role_exists(role_id: U64) -> Result<(), SvcError> {
        let db = get_db_conn().map_err(|e| anyhow!("获取数据库连接失败: {e}"))?;
        let role = AdmRoleDao::get_by_id::<_, crate::mo::adm_role::Model>(role_id, db.as_ref())
            .await
            .map_err(|e| anyhow!("查询角色({})失败: {e}", role_id.value()))?;
        if role.is_none() {
            return Err(anyhow!("角色({})不存在", role_id.value()).into());
        }
        Ok(())
    }

    /// # 取首尾空白后的必填字段
    ///
    /// ## 参数
    /// * `value` - 原值
    /// * `label` - 字段中文名，用于报错
    ///
    /// ## 返回值
    /// * `Ok(String)` - 规整后的值
    /// * `Err(anyhow::Error)` - 值为空
    fn trim_required(value: Option<&str>, label: &str) -> Result<String, anyhow::Error> {
        let trimmed = value.unwrap_or_default().trim();
        if trimmed.is_empty() {
            return Err(anyhow!("{label}不能为空"));
        }
        Ok(trimmed.to_string())
    }
}
