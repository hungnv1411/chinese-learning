# Plan thực hiện: 00 – Nền tảng

Spec: [architecture.md](architecture.md), [data-model.md](data-model.md), [non-functional.md](non-functional.md). UI: [docs/design/](../../design/index.html) (bản thiết kế cuối, thay cho wireframe ở `docs/ideas/` về mặt hình ảnh; spec vẫn là nguồn đúng về hành vi).

Module này dựng mọi thứ các module khác dùng chung. File này cũng là **nơi chốt quy ước chung**: các plan khác tham chiếu tới đây thay vì lặp lại.

---

## 1. Thứ tự xây dựng toàn dự án

Theo [README §7](../README.md#7-thứ-tự-xây-dựng-gợi-ý), cụ thể hóa thành các mốc. Mỗi mốc chạy được và kiểm thử được. Thứ tự từng bước và trạng thái nằm ở [LEDGER.md](../LEDGER.md). Ledger có kéo sớm vài bước sang mốc trước (ví dụ `05-1`, `13-5`, `07-2`). Khi ledger khác bảng dưới, làm theo ledger.

| Mốc | Module / plan | Kết quả kiểm chứng được |
|---|---|---|
| M1 | **00** (file này) | `docker compose up` chạy web + db + speech rỗng, `/healthz` trả 200, đăng nhập Google được, trang `/dev/ui` hiện đủ component theo design |
| M2 | [01-content-data](../01-content-data/plan.md) | DB có từ điển, HSK, chữ Hán, câu ví dụ; `report.md` sinh ra |
| M3 | [11-dictionary](../11-dictionary/plan.md) | Tra từ, trang `/tu/…`, `/chu/…` chạy với dữ liệu thật |
| M4 | [02-curriculum](../02-curriculum/plan.md) | `import_content --check` qua; có nội dung Phát âm + 2 chủ đề HSK 1 |
| M5 | [08-speaking/plan-speech-service](../08-speaking/plan-speech-service.md) | Dịch vụ chấm qua bộ kiểm thử TTS |
| M6 | [06-lesson](../06-lesson/plan.md), [07-writing](../07-writing/plan.md), [08-speaking/plan-speaking-ui](../08-speaking/plan-speaking-ui.md), [09-review](../09-review/plan.md) | Học hết một bài, ôn tập được |
| M7 | [05-learning-path](../05-learning-path/plan.md), [04-home](../04-home/plan.md), [03-auth](../03-auth/plan.md) | Luồng E2E: khách học thử → đăng nhập → học tiếp → ôn tập |
| M8 | [10-pronunciation](../10-pronunciation/plan.md) | Bảng pinyin, luyện nghe thanh, bài kiểm tra pinyin |
| M9 | [12-exam-certificate](../12-exam-certificate/plan.md), [13-profile](../13-profile/plan.md) | Thi cuối, nhận chứng nhận, trang Tôi |
| M10 | 02 (sản xuất nội dung) | Toàn bộ HSK 1, rồi HSK 2, HSK 3 |

Ghi chú: Better Auth (đăng nhập Google cơ bản) được kéo lên M1 vì mọi API ghi dữ liệu cần phiên đăng nhập. Module 03 còn lại phần học thử, chuyển tiến độ khách, đăng xuất, xóa tài khoản.

---

## 2. Quyết định kỹ thuật chung (chốt cho mọi module)

| Mục | Chọn | Lý do |
|---|---|---|
| Quản lý repo | pnpm workspaces (TS) + `uv` (Python) | Một repo, nhiều gói |
| Node | 22 LTS | |
| Next.js | Bản ổn định mới nhất lúc bắt đầu (≥ 15), App Router, React Server Components | Spec |
| ORM | **Drizzle** + drizzle-kit migration | Nhẹ, SQL rõ ràng; pipeline Python ghi thẳng vào cùng bảng bằng SQL |
| Validation | zod (TS), pydantic v2 (Python) | |
| State client | React state + `useReducer` cho trình chạy bài; TanStack Query cho dữ liệu server | Không cần store toàn cục |
| Test TS | Vitest (+ Testing Library) | |
| Test Python | pytest | |
| E2E | Playwright, chạy ở các viewport trong `DESIGN-MANIFEST.json` | |
| CSS | **Port nguyên `docs/design/styles.css`** thành các file CSS toàn cục, giữ tên class của design. Tailwind chỉ dùng cho tiện ích bố cục nhỏ, không thay thế class của design | Design là “hợp đồng hình ảnh”; giữ class giúp so sánh trực tiếp |
| Chuỗi giao diện | Gom vào `apps/web/lib/strings/vi.ts` | non-functional §3 |
| Rate limit | Bộ đếm cửa sổ trượt trong bộ nhớ của tiến trình web (một VPS, một container, D15) | Đơn giản; đổi sang Postgres sau nếu chạy nhiều bản |

### Cấu trúc repo

```
/apps/web                 Next.js (UI + API)
  app/                    route (xem mục 6)
  components/ui/          component design system (mục 5)
  components/<module>/    component của từng module
  db/schema/*.ts          Drizzle schema, mỗi nhóm bảng một file
  db/migrations/
  lib/config.ts           đọc biến môi trường
  lib/api/                tiện ích route handler (mục 7)
  lib/gateway/            lớp dữ liệu phía client: ServerGateway / GuestGateway (mục 8)
  lib/strings/vi.ts
  styles/                 CSS port từ design (mục 5)
/packages/core            logic thuần TypeScript dùng chung client + server (mục 4)
  src/*.ts, fixtures/*.json
/services/speech          FastAPI chấm phát âm (GPL-3.0)
/pipeline                 Python: nhập dữ liệu, tạo audio, soạn nội dung (MIT)
/content                  YAML nội dung (CC BY-SA 4.0)
/data/raw                 dữ liệu nguồn (gitignore, chỉ commit manifest + script)
/deploy                   docker-compose*.yml, Caddyfile, backup.sh
/e2e                      Playwright
```

---

## 3. Bảng đối chiếu design ↔ spec

Design ở `docs/design/` là bản chốt về **hình ảnh**. Khi design khác spec về **hành vi**, làm theo spec như bảng dưới:

| # | Design | Làm thế nào |
|---|---|---|
| 1 | `app.js` dùng `speechSynthesis` của trình duyệt để phát âm | **Bỏ.** Spec cấm Web Speech API. Mọi nút `data-say` thay bằng `<AudioButton src=…>` phát file MP3 trên R2 |
| 2 | Cài đặt pinyin có giá trị `hide` | Dùng `never` theo data-model (`always` \| `new` \| `never`). Class `body.no-py` vẫn giữ |
| 3 | Cài đặt lưu ở `localStorage['od.prefs']` | Người dùng: bảng `user_settings`. Khách: trong `guest_progress_v1.settings` |
| 4 | Phản hồi đúng/sai hiện ở `.focus-foot.ok/.bad` | Giữ như design. Đây chính là “bottom sheet phản hồi” của spec |
| 5 | `.focus-body` rộng tối đa 640px | Giữ 640px (spec ghi “khoảng 480px”) |
| 6 | Hộp thoại dùng `<dialog class="sheet">` | Giữ. Spec chỉ cấm `alert/confirm` của trình duyệt, không cấm `<dialog>` |
| 7 | Hộp “Xóa tài khoản” không có ô gõ xác nhận | **Thêm** ô gõ xác nhận theo 03-auth §6, giữ nguyên style `.field` |
| 8 | Dữ liệu tĩnh (Nguyễn Văn An, “5 ngày liên tiếp”, điểm số…) | Thay bằng dữ liệu thật, giữ nguyên câu chữ mẫu làm định dạng |
| 9 | `index.html` là trang tổng quan các màn hình | Không làm route. Chỉ dùng tham khảo |
| 10 | Phông `Feather Bold`, `DIN Round Pro` | Là phông độc quyền, **không** đưa vào repo. Giữ nguyên stack fallback của design. `Mona Sans` (SIL OFL) tự host bằng `next/font/local`. Chữ Hán chỉ dùng phông hệ thống (`--font-cjk`) |
| 11 | Logo `学` + chữ “Tiếng Trung” ở thanh điều hướng | Chữ thương hiệu đọc từ `SITE_NAME` (D16) |
| 12 | Màn hình luyện viết, luyện nói là trang riêng | Trong sản phẩm là **bước** trong trình chạy bài (06), dùng lại component. Luyện viết tự do mở từ trang chữ `/chu/{char}` |

---

## 4. `packages/core`: hợp đồng logic dùng chung

Mọi hàm ở đây là **hàm thuần** (không IO, không `Date.now()` ngầm, thời gian truyền vào). Chạy được ở trình duyệt (cho khách) và server (cho người dùng đăng nhập, và để kiểm tra lại dữ liệu khách). Module nào sở hữu file thì viết test cho file đó.

| File | Hàm chính (chữ ký) | Sở hữu |
|---|---|---|
| `pinyin.ts` | `parseNumbered(s: string): { base: string; tone: Tone }` · `numberedToMarked(s: string, opts?: { join?: boolean }): string` · `toPlain(s: string): string` · `splitSyllables(numbered: string): string[]` | 00 |
| `sandhi.ts` | `applyToneSandhi(syllables: SandhiSyllable[], opts?: { wordLengths?: number[]; ordinalIndexes?: number[] }): Tone[]` | 00 |
| `content.ts` | zod `LessonContentSchema`, `StepSpec`, `ExerciseType`, `StageId`… (định dạng `lesson.content` JSONB) | 02 |
| `unlock.ts` | `computeUnlockState(curriculum: CurriculumIndex, progress: ProgressSnapshot): UnlockState` · `lockReason(id, state, curriculum): LockReason` | 05 |
| `completion.ts` | `checkLessonCompletion(steps: StepSpec[], stepState: StepState): { complete: boolean; missing: number[] }` | 06 |
| `scoring.ts` | `writingScore({ misses, usedHint }): number` · `scoreCheckpoint(items): { pct; passed }` · `scoreExam(sections): ExamScore` · hằng số `WRITING_PASS = 60`, `SPEAKING_PASS = 60`, `CHECKPOINT_PASS = 70`, `EXAM_TOTAL_PASS = 70`, `EXAM_SECTION_MIN = 12.5` | 06, 07, 12 |
| `speaking.ts` | `nextSpeakingState(state, result, ctx: { maxTries: 3 \| 2 }): SpeakingState` | 08 |
| `srs.ts` | `newCard(now)`, `review(card, rating, now)`, `previewIntervals(card, now, buttons: 2 \| 4)`, `masteryOfWord(cards): Mastery`, `dailyReviewLimit(goal: 5 \| 10 \| 20)` | 09 |
| `streak.ts` | `isActiveDay(day: DailyActivity): boolean` · `computeStreak(days: DailyActivity[], today: string): StreakInfo` | 04 |
| `today.ts` | `pickMainCard(input: TodayInput): MainCard` · `characterOfDay(seed: string, date: string, pool: string[]): string` | 04 |
| `guest.ts` | zod `GuestProgressV1Schema` · `mergeGuestProgress(account, guest, ctx): MergePlan` · `trialPrompt(completedNormal: number): TrialPrompt` · `GUEST_LESSON_LIMIT = 3` | 03 |
| `dictionary.ts` | `classifyQuery(q: string, chip: Chip): QueryKind[]` | 11 |
| `certificate.ts` | `generateCertificateCode(stageNumber, rand): string` · `validateCertificateName(s): boolean` | 12 |
| `exam.ts` | `examEligibility(input): { ok: true } \| { ok: false; reason; until? }` | 12 |

Kiểu dùng chung đặt ở `packages/core/src/types.ts`: `Tone = 1|2|3|4|5`, `StageId = 'pron'|'hsk1'|'hsk2'|'hsk3'`, `CardType = 'recognize'|'listen'|'write'`, `Rating = 'again'|'hard'|'good'|'easy'`, `SandhiSyllable = { pinyin: string /* có số thanh, ví dụ 'ni3' */; hanzi?: string }`.

**Bộ test dùng chung TS ↔ Python:** `packages/core/fixtures/pinyin.json` và `tone-sandhi.json`. Vitest đọc, và pytest ở `pipeline/` và `services/speech/` đọc **cùng file** (đường dẫn tương đối từ gốc repo). Spec yêu cầu bản Python của biến điệu có cùng bộ test.

---

## 5. Design system (port từ `docs/design/`)

### CSS
Tách `docs/design/styles.css` theo đúng các phần đã đánh số trong file:

| File | Nội dung |
|---|---|
| `styles/tokens.css` | Phần 1 và 2 (token Duolingo + token mở rộng, màu thanh `--tone-1..4`, `--font-cjk`) **chép nguyên văn** |
| `styles/base.css` | Phần 3 |
| `styles/components.css` | Phần 4 (`.btn*`, `.card`, `.badge*`, `.progress`, `.field`, `.seg`, `.switch`, `.list`, `dialog`/`.sheet`, `.toast`, `.hz*`, `.py`, `.hv`, `.t1–.t5`, `.audio`) |
| `styles/shell.css` | Phần 5 (`.main`, `.topbar`, `.nav`, `.cols/.rail`, `.focus*`) |
| `styles/screens/<module>.css` | Phần 6, cắt theo màn hình. Mỗi module tự chép phần của mình khi làm màn hình đó |

Không đổi giá trị token. Không thêm màu nền ngoài token (DESIGN-HANDOFF “Color and brand contract”).

### Component (`apps/web/components/ui/`)
| Component | Tương ứng design | Ghi chú |
|---|---|---|
| `Icon name=…` | `ICONS` trong `app.js` | Chép nguyên path SVG |
| `Button variant=primary\|secondary\|blue\|streak\|danger\|white\|quiet size block` | `.btn-*` | Trạng thái disabled theo `[disabled]` |
| `IconButton label` | `.icon-btn` | `aria-label` bắt buộc (non-functional §4) |
| `Card`, `Badge`, `Chip`, `Progress value`, `Seg`, `Switch`, `Field` | như tên class | `Switch` dùng `role="switch" aria-checked` |
| `Sheet` | `<dialog class="sheet">` | `showModal()`, đóng khi bấm nền, trả focus về nút mở |
| `Toast` + `useToast()` | `.toast` | `role="status"`, 2,8 giây |
| `Hanzi text tones size` | `.hz .t1–.t5` | Tô màu từng chữ theo thanh |
| `Pinyin numbered` | `.py` | Hiển thị dấu thanh (dùng `numberedToMarked`), tô màu từng âm tiết |
| `HanViet values` | `.hv` | Ẩn khi tắt Hán Việt |
| `ToneContour tone userContour?` | `CONTOUR` trong `app.js` (viewBox 60×40) | Thêm đường nét đứt cho contour người học (10-pronunciation §4) |
| `AudioButton src slow?` | `.audio` | Phát MP3 qua `useAudio()` (mục 9) |
| `AppShell nav` | `buildNav()` | 5 tab: Hôm nay, Lộ trình, Ôn tập, Tra từ, Tôi + “Bảng pinyin” + chân “Nguồn dữ liệu”. Dưới cùng khi < 768px, thanh dọc 88px từ 768px, 256px từ 1200px |
| `FocusLayout top body foot` | `.focus*` | Cho bài học, ôn tập, kiểm tra. Không có thanh tab |

**Cài đặt hiển thị** áp lên `<body>` bằng class `no-hv`, `no-tone`, `no-py` (giống `applyPrefs()`), qua `SettingsProvider` đọc từ gateway. `trad` (phồn thể) do component `Hanzi` chọn chữ.

### Các bước
1. Port CSS và font. Kiểm tra: trang `/dev/ui` (chỉ có ở `dev`) render mọi component ở mọi trạng thái (default, hover, focus, active, disabled, loading).
2. Viết `AppShell`, `FocusLayout`. Kiểm tra bằng Playwright ở 9 viewport của `DESIGN-MANIFEST.json`:
   - Không cuộn ngang: `document.documentElement.scrollWidth <= innerWidth`.
   - Thanh điều hướng đúng dạng theo ngưỡng 768/1200.
   - Ảnh chụp `/dev/ui` và ảnh chụp `docs/design/today.html` lưu vào `e2e/__screenshots__/` để so sánh bằng mắt.
3. Kiểm tra phóng chữ 130% (non-functional §1): test Playwright đặt `font-size: 130%` ở `html`, không có phần tử nào tràn ngang.
4. Test component (Vitest): `Hanzi` gán đúng class `t3` cho 好 khi `tones=[3]`; `IconButton` thiếu `label` thì báo lỗi kiểu TS; `Switch` đổi `aria-checked` khi bấm.

---

## 6. Bảng route (dùng chung)

| Route | Màn hình design | Module | Render |
|---|---|---|---|
| `/` | `onboarding.html` (khách mới) / chuyển tới `/hom-nay` | 04 | client |
| `/hom-nay` | `today.html` | 04 | client |
| `/lo-trinh` | `path.html` | 05 | client |
| `/bai/[lessonId]` | `lesson.html`, `writing.html`, `speaking.html` | 06, 07, 08 | client |
| `/on-tap`, `/on-tap/phien` | `review.html` | 09 | client |
| `/pinyin` | `pinyin.html` | 10 | client (dữ liệu tĩnh) |
| `/tra-tu` | `dictionary.html` | 11 | client + SSR khung |
| `/tu/[word]`, `/chu/[char]` | `dictionary.html` (phần chi tiết) | 11 | **SSR + cache 1 ngày** |
| `/kiem-tra/[stage]` | `exam.html` | 12 | client |
| `/chung-nhan/[code]` | `certificate.html` | 12 | **SSR**, `noindex` |
| `/toi` | `profile.html` | 13 | client |
| `/nguon-du-lieu` | `sources.html` | 13 | SSR tĩnh |
| `/gioi-thieu`, `/quyen-rieng-tu`, `/dieu-khoan` | (theo style `sources.html`) | 13 | SSR tĩnh |
| `/admin/reports` | (dùng component sẵn có) | 13 | SSR, chỉ `ADMIN_EMAILS` |

---

## 7. Quy ước API

- Route handler trong `app/api/**/route.ts`. JSON vào, JSON ra.
- Lỗi: `{ "error": { "code": "LESSON_LOCKED", "message": "…tiếng Việt…" } }` với HTTP status đúng nghĩa (400, 401, 403, 404, 409, 429, 503).
- Mọi body được kiểm tra bằng zod. Không tin dữ liệu client về mở khóa hay đạt (architecture §5).
- Tiện ích trong `lib/api/`:
  - `getViewer(req): Promise<{ kind: 'user'; userId: string } | { kind: 'guest'; ip: string }>`, nhận cả cookie và `Authorization: Bearer` (plugin bearer của Better Auth).
  - `requireUser(req)`: ném 401 nếu là khách.
  - `rateLimit(key: string, limit: number, windowSec: number): { ok: boolean; retryAfterSec: number }`.
  - `handler(schema, fn)`: bọc parse zod + bắt lỗi thành định dạng chuẩn.
- Test: `rateLimit` cho qua đúng `limit` lần trong cửa sổ, lần sau trả `ok=false`, qua cửa sổ thì cho lại; `requireUser` với khách trả 401 đúng định dạng.

---

## 8. Lớp dữ liệu phía client (`lib/gateway/`)

Khách và người dùng đăng nhập dùng **cùng giao diện màn hình**. Khác nhau chỉ ở nơi lưu:

- `ProgressGateway` (interface): mỗi module **tự thêm** phương thức của mình (ví dụ 06 thêm `loadLesson`, `saveStep`, `completeLesson`; 09 thêm `startReview`, `answerReview`…).
- `ServerGateway`: gọi API.
- `GuestGateway`: đọc/ghi `GuestStore` và chạy logic `packages/core` tại chỗ. Nội dung bài lấy từ API công khai.
- `GuestStore` (`lib/gateway/guest-store.ts`): khóa `guest_progress_v1`, mọi lần đọc/ghi bọc `try/catch`; không ghi được thì giữ trong bộ nhớ và đặt cờ `persistent = false` để giao diện hiện cảnh báo “Tiến độ sẽ mất khi đóng trang” (03-auth §4).
- `useGateway()` chọn bản theo phiên đăng nhập.

Test: `GuestStore` khi `localStorage.setItem` ném lỗi vẫn đọc lại được dữ liệu vừa ghi trong phiên và `persistent === false`.

---

## 9. Audio phía client

- `useAudio()` trả `{ play(src, rate?), preload(srcs[]) }`. Một `HTMLAudioElement` dùng chung, `preload` tạo cache `Audio` theo URL.
- Đường dẫn: `audioUrl(kind, key, voice)` → `${R2_PUBLIC_URL}/${kind}/${voice}/${key}.mp3`, với `voice` là `xiaoxiao` (nữ) hoặc `yunxi` (nam) theo cài đặt.
- iOS: không tự phát trước thao tác chạm đầu tiên. `useAudio` giữ cờ `unlocked`, đặt khi có `pointerdown` đầu tiên.
- Đọc chậm: tùy quyết định ở 01 (file `.slow.mp3` hay `playbackRate`). `AudioButton slow` gọi `audioUrl(..., { slow: true })`, hàm này quyết định theo cấu hình `AUDIO_SLOW_MODE = 'file' | 'rate'`.

---

## 10. Hạ tầng, cấu hình, database

### Bước 1. Khung repo và CI
- pnpm workspace, `tsconfig.base.json`, ESLint, Prettier; `pipeline/` và `services/speech/` dùng `uv`, ruff.
- File giấy phép: `LICENSE` ở gốc giải thích cách chia; `apps/web/LICENSE` và `pipeline/LICENSE` MIT; `services/speech/LICENSE` GPL-3.0; `content/LICENSE` CC BY-SA 4.0 (sources-and-licenses).
- GitHub Actions: lint, typecheck, vitest, pytest (pipeline + speech). E2E chạy job riêng.
- Xong khi: CI xanh trên repo rỗng có một test mẫu mỗi gói.

### Bước 2. Cấu hình
- `apps/web/lib/config.ts` parse bằng zod: `SITE_NAME`, `SITE_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `SPEECH_URL` (mặc định `http://speech:8000`), `ADMIN_EMAILS`, `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `TTS_DAILY_LIMIT` (mặc định 500), `AUDIO_SLOW_MODE`, `REPO_URL` (link tải nội dung ở trang Nguồn dữ liệu).
- Tên website và tên miền **chỉ** đọc từ `SITE_NAME`, `SITE_URL` (D16).
- Test: thiếu `SITE_NAME` thì khởi động báo lỗi rõ; một test quét `apps/web/{app,components,lib}` không được chứa chuỗi tên miền viết cứng (danh sách mẫu trong test).

### Bước 3. Docker Compose
- `deploy/docker-compose.yml`: `caddy`, `web`, `speech` (chỉ mạng nội bộ, không `ports`), `db` (postgres:16). Script init bật `unaccent`, `pg_trgm`.
- `deploy/docker-compose.dev.yml`: thêm volume mã nguồn, seed dữ liệu mẫu (Phát âm + 2 chủ đề HSK 1, sinh từ 01 + 02 khi đã có; trước đó seed rỗng).
- `GET /healthz` của web: kiểm tra kết nối DB, trả `{ ok: true }`.
- Xong khi: `docker compose up` rồi `curl https://localhost/healthz` trả 200; `speech` không truy cập được từ máy host.

### Bước 4. Schema database (Drizzle)
Các file trong `apps/web/db/schema/`:

| File | Bảng |
|---|---|
| `reference.ts` | `dict_entry`, `hsk_word`, `hsk_char`, `hsk_grammar`, `hanzi`, `radical_vi`, `sentence`, `sentence_word`, `audio_asset` |
| `curriculum.ts` | `stage`, `unit`, `lesson`, `lesson_word`, `lesson_char`, `grammar_point`, `exam_item`, `content_meta` |
| `auth.ts` | `user`, `session`, `account`, `verification` (theo Better Auth) + `display_name`, `certificate_name` |
| `progress.ts` | `user_settings`, `lesson_progress`, `stage_progress`, `daily_activity`, `char_written`, `tone_drill_stat` |
| `srs.ts` | `srs_card`, `srs_review_log` |
| `speaking.ts` | `speaking_attempt` |
| `exam.ts` | `exam_attempt`, `certificate`, `certificate_name_change` |
| `ops.ts` | `content_report`, `tts_daily_counter` |

Bổ sung so với data-model (đã cân nhắc, cần để module chạy):
- `audio_asset.hash` (sha256 của `text + voice + rate + phoneme`) để `generate_audio` bỏ qua file đã có.
- `dict_entry.cedict_order` (thứ tự dòng gốc, để xếp hạng tìm kiếm) và cột sinh `definitions_tsv` (tsvector tiếng Anh).
- `hanzi.han_viet_source` (`unihan` | `manual` | `ai`) để trang Nguồn dữ liệu ghi rõ âm do AI bổ sung.
- `daily_activity.seconds` (tích lũy chính xác, hiển thị theo phút).
- `exam_attempt.deadline_at`, `exam_attempt.sections` (JSONB: thời điểm bắt đầu/kết thúc từng phần); `exam_item.answer` (JSONB, không bao giờ gửi client).
- `certificate`: unique `(user_id, stage_id)` khi `revoked = false`.
- `unit.published` (bool) cho “Sắp ra mắt”; `stage.exam_open` (bool) khi lộ trình đủ điều kiện phát hành.
- `content_meta(key, value)` lưu `content_version` hiện tại.
- `srs_card`: dùng `dict_entry_id` (bắt buộc) + `hsk_word_id` (null được). Ràng buộc duy nhất `(user_id, dict_entry_id, card_type)`.
- `char_written(user_id, char, first_passed_at)`: chữ đã đạt ở chế độ Tự viết (cho thống kê 13).
- `tone_drill_stat(user_id, tone, correct, total)` (10 §2).
- `certificate_name_change(certificate_id, old_name, new_name, changed_at)` (12, tối đa 3 lần).
- `tts_daily_counter(date, count)` (giới hạn 500 lần tạo audio/ngày).
- `lesson_progress`: khóa chính `(user_id, lesson_id)`; thêm `content_version`. Trạng thái `locked/available` **không lưu**, tính bằng `computeUnlockState`.
- Bài ôn chủ đề: `lesson_progress.status = 'completed'` **chỉ khi đạt** (≥ 70%). Làm chưa đạt thì cập nhật `attempts`, `best_score`, giữ `in_progress`. Nhờ vậy quy tắc mở khóa chỉ cần đọc `completed`.
- Index: `dict_entry(simplified)`, `dict_entry(pinyin_plain)` dạng `text_pattern_ops`, GIN `pg_trgm` trên `simplified`, GIN `tsvector` trên `definitions`, `srs_card(user_id, due) WHERE NOT suspended`.

Test (chạy với Postgres thật trong CI bằng service container):
- Migration chạy trên DB trống không lỗi.
- Chèn trùng `certificate.code` bị từ chối; chèn trùng `(user_id, dict_entry_id, card_type)` bị từ chối.
- Xóa `user` thì xóa dây chuyền `lesson_progress`, `srs_card`, `daily_activity`… (trừ `certificate`, do 03 xử lý riêng).

### Bước 5. Better Auth (Google)
- `lib/auth.ts`: Better Auth với adapter Drizzle, chỉ provider Google, `session.expiresIn = 30 ngày`, `updateAge = 1 ngày` (tự gia hạn), plugin `bearer`.
- Khi tạo user: `display_name` và `certificate_name` = tên Google; tạo `user_settings` mặc định.
- Route `app/api/auth/[...all]/route.ts`.
- Test: hook tạo user điền `certificate_name`; `getViewer` nhận cả cookie và bearer token (test với session tạo trực tiếp trong DB).

### Bước 6. `packages/core`: pinyin và biến điệu
Hai file này dùng sớm nhất (pipeline, speech, giao diện), nên làm ở đây.

**`pinyin.ts`**, test với `fixtures/pinyin.json`:
- `numberedToMarked('hao3 chi1', { join: true })` → `hǎochī`; `'lu:4'` → `lǜ`; `'nu:3'` → `nǚ`; `'ma5'` → `ma`.
- Đặt dấu: `liu2` → `liú`, `gui4` → `guì`, `xue2` → `xué`, `zhao4` → `zhào`, `er2` → `ér`.
- `toPlain('hǎo chī')` → `haochi`; `toPlain('nǚ')` → `nu` (để tìm kiếm).

**`sandhi.ts`**, test với `fixtures/tone-sandhi.json`. Thuật toán:
1. Trong một từ (theo `wordLengths`, mặc định cả chuỗi là một từ): duyệt trái → phải trên **thanh viết gốc**, âm tiết thanh 3 đứng trước âm tiết thanh 3 thì thành thanh 2.
2. Giữa hai từ: âm tiết cuối của từ trước (vẫn là thanh 3) đổi thành 2 chỉ khi âm tiết đầu của từ sau **vẫn đọc** thanh 3 (dùng thanh đọc đã tính của từ sau, nên xử lý từ phải sang trái).
3. 不 (`hanzi === '不'`) + thanh viết 4 → 2.
4. 一 (`hanzi === '一'`): trong `ordinalIndexes` hoặc đứng cuối → 1; trước thanh viết 4 → 2; trước thanh 1/2/3 → 4; trước thanh 5 → giữ 1.
5. Thanh 5 giữ nguyên.

Ca kiểm thử bắt buộc:

| Đầu vào | wordLengths | Kết quả |
|---|---|---|
| 你好 `ni3 hao3` | – | 2, 3 |
| 展览馆 `zhan3 lan3 guan3` | – | 2, 2, 3 |
| 小老虎 `xiao3 lao3 hu3` | [1, 2] | 3, 2, 3 |
| 我很好 `wo3 hen3 hao3` | [1, 2] | 3, 2, 3 |
| 不是 `bu4 shi4` | – | 2, 4 |
| 不好 `bu4 hao3` | – | 4, 3 |
| 一个 `yi1 ge4` | – | 2, 4 |
| 一天 `yi1 tian1` | – | 4, 1 |
| 第一 `di4 yi1` | ordinal [1] | 4, 1 |
| 十一 `shi2 yi1` | – | 2, 1 |
| 你们 `ni3 men5` | – | 3, 5 |

### Bước 7. Sao lưu
- `deploy/backup.sh`: `pg_dump | gzip`, đẩy lên R2 `backups/YYYY-MM-DD.sql.gz`, xóa bản cũ chỉ giữ 14 bản. Chạy bằng cron trong container `backup` nhỏ.
- Test: script có chế độ `--dry-run` liệt kê bản sẽ xóa; test bash với danh sách giả 16 bản thì xóa đúng 2 bản cũ nhất.

---

## 11. Xong module khi
- `docker compose up` ở `dev` chạy đủ dịch vụ, `/healthz` 200.
- Đăng nhập Google được, `getViewer` hoạt động với cookie và bearer.
- `/dev/ui` khớp design ở 9 viewport, không cuộn ngang, phóng chữ 130% không vỡ.
- Test pinyin + biến điệu xanh ở cả TS và Python (bản Python viết ở 01 và 08, đọc cùng fixture).
- CI xanh.
