//! # 角色服务
//!
//! 角色本身只有「编码 / 名称 / 数据范围」三件事，业务逻辑集中在两个地方：
//!
//! * **写前规整**：编码与名称去掉首尾空白，避免「看起来一样但唯一键不冲突」的脏数据。
//! * **删前检查**：还有用户挂着这个角色时不允许删除。数据库侧是 `on delete restrict`，
//!   这里提前拦一道，把外键错误换成可读提示。

use crate::dao::AdmUserDao;
use anyhow::anyhow;
use robotech::db::get_db_conn;
use robotech::macros::svc;
use sea_orm::{ColumnTrait, Condition};

#[svc(
    before_add = AdmRoleSvc::before_add_hook,
    before_modify = AdmRoleSvc::before_modify_hook,
    before_del_by_id = AdmRoleSvc::before_del_by_id_hook
)]
pub struct AdmRoleSvc;

// SvcError 由框架定义且体积较大，而钩子的返回类型必须与宏约定一致
#[allow(clippy::result_large_err)]
impl AdmRoleSvc {
    /// # 新增前钩子：规整编码与名称
    ///
    /// `#[crud_dto]` 把每个字段都包成 `Option`，所以读写都要显式拆一层。
    async fn before_add_hook<C: ConnectionTrait>(
        mut add_dto: AdmRoleAddDto,
        _db: &C,
    ) -> Result<AdmRoleAddDto, SvcError> {
        add_dto.code = Some(Self::trim_required(add_dto.code.as_deref(), "角色编码")?);
        add_dto.name = Some(Self::trim_required(add_dto.name.as_deref(), "角色名称")?);
        // 可空列在 AddDto 里是 Option<Option<String>>，读写都要拆一层
        if let Some(remark) = add_dto.remark.clone().flatten() {
            add_dto.remark = Some(Some(remark.trim().to_string()));
        }
        Ok(add_dto)
    }

    /// # 修改前钩子：规整编码与名称
    ///
    /// 只改数据范围/排序时走不到赋值，省掉无谓的字符串拷贝。
    async fn before_modify_hook<C: ConnectionTrait>(
        mut modify_dto: AdmRoleModifyDto,
        _db: &C,
    ) -> Result<AdmRoleModifyDto, SvcError> {
        if modify_dto.code.is_some() {
            modify_dto.code = Some(Self::trim_required(modify_dto.code.as_deref(), "角色编码")?);
        }
        if modify_dto.name.is_some() {
            modify_dto.name = Some(Self::trim_required(modify_dto.name.as_deref(), "角色名称")?);
        }
        if let Some(remark) = modify_dto.remark.clone().flatten() {
            modify_dto.remark = Some(Some(remark.trim().to_string()));
        }
        Ok(modify_dto)
    }

    /// # 删除前钩子：还有用户挂着时拒绝删除
    async fn before_del_by_id_hook<C: ConnectionTrait>(id: U64, _db: &C) -> Result<U64, SvcError> {
        let count = Self::count_users_of(id).await?;
        if count > 0 {
            return Err(anyhow!(
                "角色(id={})下还有 {count} 个用户，请先把这些用户改挂到别的角色",
                id.value()
            )
            .into());
        }
        Ok(id)
    }

    /// # 统计挂在某个角色下的用户数
    ///
    /// ## 参数
    /// * `role_id` - 角色ID
    ///
    /// ## 返回值
    /// * `Ok(usize)` - 用户数量
    /// * `Err(SvcError)` - 读库失败
    async fn count_users_of(role_id: U64) -> Result<usize, SvcError> {
        let db = get_db_conn().map_err(|e| anyhow!("获取数据库连接失败: {e}"))?;
        let condition =
            Condition::all().add(crate::mo::adm_user::Column::RoleId.eq(role_id.value() as i64));
        let users = AdmUserDao::list_by_condition::<_, crate::mo::adm_user::Model>(
            condition,
            &None,
            db.as_ref(),
        )
        .await
        .map_err(|e| anyhow!("查询角色({})下的用户失败: {e}", role_id.value()))?;
        Ok(users.len())
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
