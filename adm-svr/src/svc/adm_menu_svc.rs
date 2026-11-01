//! # 菜单服务
//!
//! 菜单是一棵树，业务逻辑都围着「父子关系不能坏」打转：
//!
//! * **父节点必须存在**：`parent_id` 是自关联外键，提前校验把约束错误换成可读提示。
//! * **不能把自己挂到自己下面**：自关联的经典坑，只校验存在性是拦不住的。
//! * **按钮节点不显示在侧边栏**：按钮只承载权限编码，`visible` 由服务端按类型强制
//!   置 false，避免前端漏判导致侧边栏冒出一堆按钮。
//! * **删前检查子节点**：数据库侧是 `on delete restrict`，先拦一道给出「还有几个子节点」。

use crate::dic::MenuType;
use anyhow::anyhow;
use robotech::db::get_db_conn;
use robotech::macros::svc;
use sea_orm::{ColumnTrait, Condition};

#[svc(
    before_add = AdmMenuSvc::before_add_hook,
    before_modify = AdmMenuSvc::before_modify_hook,
    before_del_by_id = AdmMenuSvc::before_del_by_id_hook
)]
pub struct AdmMenuSvc;

// SvcError 由框架定义且体积较大，而钩子的返回类型必须与宏约定一致
#[allow(clippy::result_large_err)]
impl AdmMenuSvc {
    /// # 新增前钩子：规整字段、校验父节点、按类型落定可见性
    async fn before_add_hook<C: ConnectionTrait>(
        mut add_dto: AdmMenuAddDto,
        _db: &C,
    ) -> Result<AdmMenuAddDto, SvcError> {
        add_dto.code = Some(Self::trim_required(add_dto.code.as_deref(), "菜单编码")?);
        add_dto.name = Some(Self::trim_required(add_dto.name.as_deref(), "菜单名称")?);

        // 0 与空都表示根节点：前端下拉框习惯用 0 表示「无父级」
        let parent_id = Self::normalize_parent(add_dto.parent_id.flatten());
        if let Some(parent_id) = parent_id {
            Self::ensure_menu_exists(parent_id).await?;
        }
        add_dto.parent_id = Some(parent_id);

        if add_dto.menu_type == Some(MenuType::Button) {
            add_dto.visible = Some(false);
        }
        Ok(add_dto)
    }

    /// # 修改前钩子：父节点校验（含自引用）与可见性规整
    async fn before_modify_hook<C: ConnectionTrait>(
        mut modify_dto: AdmMenuModifyDto,
        _db: &C,
    ) -> Result<AdmMenuModifyDto, SvcError> {
        if modify_dto.code.is_some() {
            modify_dto.code = Some(Self::trim_required(modify_dto.code.as_deref(), "菜单编码")?);
        }
        if modify_dto.name.is_some() {
            modify_dto.name = Some(Self::trim_required(modify_dto.name.as_deref(), "菜单名称")?);
        }

        if modify_dto.parent_id.is_some() {
            let parent_id = Self::normalize_parent(modify_dto.parent_id.flatten());
            // 自引用只可能发生在「父节点 = 自己」这一种情况
            if parent_id.is_some() && parent_id == modify_dto.id {
                return Err(anyhow!("不能把菜单挂到自己下面").into());
            }
            if let Some(parent_id) = parent_id {
                Self::ensure_menu_exists(parent_id).await?;
            }
            modify_dto.parent_id = Some(parent_id);
        }

        if modify_dto.menu_type == Some(MenuType::Button) {
            modify_dto.visible = Some(false);
        }
        Ok(modify_dto)
    }

    /// # 删除前钩子：还有子节点时拒绝删除
    async fn before_del_by_id_hook<C: ConnectionTrait>(id: U64, _db: &C) -> Result<U64, SvcError> {
        let count = Self::count_children_of(id).await?;
        if count > 0 {
            return Err(anyhow!(
                "菜单(id={})下还有 {count} 个子节点，请先删除或移走这些子节点",
                id.value()
            )
            .into());
        }
        Ok(id)
    }

    /// # 统计某个菜单的直接子节点数
    ///
    /// 只数直接子节点：孙子节点删不掉是下一层自己的事，一次报一层比一次报一串更好定位。
    ///
    /// ## 参数
    /// * `parent_id` - 父菜单ID
    ///
    /// ## 返回值
    /// * `Ok(usize)` - 直接子节点数量
    /// * `Err(SvcError)` - 读库失败
    async fn count_children_of(parent_id: U64) -> Result<usize, SvcError> {
        let db = get_db_conn().map_err(|e| anyhow!("获取数据库连接失败: {e}"))?;
        let condition = Condition::all()
            .add(crate::mo::adm_menu::Column::ParentId.eq(parent_id.value() as i64));
        let children = AdmMenuDao::list_by_condition::<_, crate::mo::adm_menu::Model>(
            condition,
            &None,
            db.as_ref(),
        )
        .await
        .map_err(|e| anyhow!("查询菜单({})的子节点失败: {e}", parent_id.value()))?;
        Ok(children.len())
    }

    /// # 确认父菜单存在
    ///
    /// ## 参数
    /// * `menu_id` - 父菜单ID
    ///
    /// ## 返回值
    /// * `Ok(())` - 父菜单存在
    /// * `Err(SvcError)` - 父菜单不存在或读库失败
    async fn ensure_menu_exists(menu_id: U64) -> Result<(), SvcError> {
        let db = get_db_conn().map_err(|e| anyhow!("获取数据库连接失败: {e}"))?;
        let menu = AdmMenuDao::get_by_id::<_, crate::mo::adm_menu::Model>(menu_id, db.as_ref())
            .await
            .map_err(|e| anyhow!("查询父菜单({})失败: {e}", menu_id.value()))?;
        if menu.is_none() {
            return Err(anyhow!("父菜单({})不存在", menu_id.value()).into());
        }
        Ok(())
    }

    /// # 把 0 归一成空（根节点）
    ///
    /// ## 参数
    /// * `parent_id` - 前端传来的父节点ID
    ///
    /// ## 返回值
    /// * `Option<U64>` - 根节点为 `None`
    fn normalize_parent(parent_id: Option<U64>) -> Option<U64> {
        parent_id.filter(|id| id.value() > 0)
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
