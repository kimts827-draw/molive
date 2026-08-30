-- 자료실 게시물 대표 이미지 저장소.
-- 열람은 공개(public bucket), 업로드/수정/삭제는 service_role(= 관리자 전용 서버 라우트)만 가능하다.
-- storage.objects에 anon/authenticated 정책을 추가하지 않으므로 일반 사용자는 브라우저에서 직접 올릴 수 없다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resource-assets', 'resource-assets', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
