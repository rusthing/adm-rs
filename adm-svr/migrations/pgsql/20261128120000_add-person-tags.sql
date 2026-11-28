-- 人员标签：与 dtw_region.tags 同用管道分隔，但只存标签名、不带 #色值
-- 不建字典表：adm 侧没有统一标签字典，写入原样保存，切分/去重由调用方负责

alter table adm_person add column tags VARCHAR(255) null;

comment on column adm_person.tags is
'人员标签
|标签A|标签B| 形式（管道分隔、只存标签名，不携带 dtw_region.tags 的 #色值）；NULL 表示无标签
接口原样写库，切分/去重/字典校验由调用方负责
@len 0..=255';
