//! # 用户口令路由
//!
//! `POST /adm/user/{id}/reset-password`。静态段 `reset-password` 挂在参数段
//! `{id}` 之后，与 CRUD 的 `/adm/user/{id}` 不冲突；`web/router` 下的路由自检单测
//! 会在装配阶段就把冲突炸出来。
//!
//! 生成的代码一次性导入四个路由构造器，本模块只用到 `post`，因此屏蔽未使用导入告警。

#![allow(unused_imports)]

use robotech::macros::router;

#[router(routes [("/adm/user/{id}/reset-password", post(reset_password))])]
struct AdmUserPasswordRouter;
