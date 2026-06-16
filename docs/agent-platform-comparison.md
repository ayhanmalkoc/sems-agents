# Agent Platform Karşılaştırması

Tarih: 2026-06-15

Karşılaştırılan projeler:

- Yerel: `craft-agent` / `C:\dev\sems-agents`
- Uzak: `pewdiepie-archdaemon/odysseus` — commit `933ec8fec981ecbd1f1002b848f65bec17430eb6`
- Uzak: `NousResearch/hermes-agent` — 2026-06-15 tarihinde alınan güncel sığ klon

## Yönetici Özeti

`craft-agent`, ürünleşmiş masaüstü/sunucu agent platformuna en yakın proje. TypeScript/Bun monorepo yapısı, Electron/Web arayüzleri, session-scoped tools, MCP/session araçları, model bağlantı testleri, izin/sandbox/interceptor kodları ve paketlenebilir sunucu yapısı öne çıkıyor. Ana avantajı: uygulama mimarisi ve tip güvenli entegrasyon disiplini.

`odysseus`, self-hosted AI workspace fikrine en yakın proje. Python/FastAPI backend, geniş local-first özellikler, Docker Compose, RAG/vector memory, arama, mail/takvim/not/görev özellikleri ve çok sayıda entegrasyon sunuyor. Ana avantajı: kullanıcıya dönük workspace özelliklerinin genişliği.

`hermes-agent`, terminal-native otonom agent runtime tarafında en güçlü proje. Python ağırlıklı çekirdek, CLI/TUI/gateway girişleri, toolset yapısı, skills, memory, MCP, plugin sistemi, delegation, cron/hooks, checkpoints/worktrees ve mesajlaşma platformları öne çıkıyor. Ana avantajı: agent runtime derinliği ve operasyonel otonomi.

## Karşılaştırma Matrisi

| Boyut | `craft-agent` | `odysseus` | `hermes-agent` |
|---|---|---|---|
| Hedef kimlik | UI-first Jarvis/coding-agent platformu | Self-hosted kişisel AI workspace | Terminal-native otonom agent runtime |
| Ana mimari avantaj | Typed TS monorepo + Electron/Web UI + session-scoped runtime | Geniş local-first workspace özellikleri | Derin agent runtime + skills/plugins/gateway |
| Ana teknoloji | TypeScript, Bun, Electron, Vite | Python, FastAPI, SQLAlchemy, ChromaDB, FastEmbed, Docker | Python, Node workspaces, CLI/TUI/web/gateway |
| Repo yapısı | `packages/*`, `apps/*` monorepo; shared/server/session-tools ayrımı güçlü | Büyük Python uygulaması + web/docs/tools | Büyük Python agent çekirdeği + plugins/skills/gateway/UI |
| Kullanıcı arayüzleri | Electron, Web UI, Viewer, Server; Jarvis cockpit için güçlü temel | Web/PWA, mobile-friendly self-host workspace | CLI, TUI, Web, messaging gateway |
| Runtime çekirdeği | `SessionManager` + session-scoped tools + callback registry | Workspace agent + app entegrasyonları | Agent loop + providers/transports/toolsets |
| Session izolasyonu | Güçlü: sessionId keyed callbacks, session-specific tools | Orta: workspace/app odaklı | Güçlü: sessions/profiles/runtime state |
| Tool modeli | Merkezi `SESSION_TOOL_REGISTRY`, zod schemas, `safeMode`, `executionMode` | Geniş ama daha app içine yayılmış tool seti | Toolsets + MCP + plugin tools |
| Backend-executed tools | Mevcut: `call_llm`, `spawn_session`, `browser_tool`, `right_dock`, `agents`, `automations` | Mevcut: web/files/MCP/search/app tools | Mevcut: geniş built-in tools + MCP/plugins |
| Agent self-management | Güçlüleşiyor: `agents` ve `automations` tool agent’a yönetim yüzeyi açıyor | Daha çok workspace özellikleri üzerinden | Güçlü: skills/profiles/config/automation odaklı |
| Agent profiles | Mevcut: `mainAgentProfileId`, `activeAgentProfileId`, `skillSlugs`, `delegationMode` | Daha az belirgin | Güçlü: profiles/sessions/context/personality |
| Skills | Mevcut model/validation/profile bağlantısı var; runtime/UX ürünleşmesi eksik | Daha az merkezi | Birinci sınıf procedural memory sistemi |
| Delegation | Temel var: `spawn_session`, delegation alanları; orchestration eksik | Daha az net | Güçlü: delegation/child agents/workflows |
| Automation | Mevcut: app+agent events, `SchedulerTick`, prompt/webhook actions, history/replay, management tool | Notes/tasks/reminders/scheduled tasks güçlü | Cron, hooks, goals, delegation, gateway delivery güçlü |
| Long-running goals | Eksik: `GoalManager`/`TaskRun` state machine gerekli | Scheduled tasks var; goal runtime daha az net | Güçlü: goals/autonomous workflows |
| Memory/context | Skills/context/search var; persistent semantic memory/RAG ayrı katman olarak eksik | Güçlü: RAG/vector memory + workspace data | Güçlü: persistent memory + context files + sessions |
| RAG/search | Search yüzeyleri var; unified semantic memory değil | Güçlü: ChromaDB/FastEmbed core dependency | Memory/context güçlü; RAG yaklaşımı runtime’a bağlı |
| MCP yaklaşımı | Mevcut: `McpClient`, `McpClientPool`, sources/OAuth/credentials | Workspace-agent entegrasyonu olarak mevcut | Birinci sınıf config/preset konusu |
| Gateway | Mevcut temel: messaging adapters + automation binder; secure command bus eksik | Bildirim/workspace entegrasyonları var | Çok güçlü: Telegram/Discord/Slack/WhatsApp/Signal vb. |
| Safety/permissions | Güçlü temel: `safeMode`, permission mode, sandbox/interceptor yüzeyleri | Self-host/local-first güven modeli | Güçlü: approvals, isolation, worktrees/checkpoints dokümanlı |
| Checkpoint/rollback | Belirgin ürünleşmiş katman eksik | Daha az belirgin | Güçlü fikir: checkpoints/worktrees |
| Deployment | Server build, `Dockerfile.server`, Electron paketleme | Docker Compose self-hosting güçlü | Install scripts, native Windows/Linux/macOS/Termux, Docker/worktrees |
| Jarvis’e uygunluk | Çok yüksek: UI + typed runtime + automation temeli birleşiyor | Orta-yüksek: workspace/memory/task fikirleri alınmalı | Çok yüksek: autonomous runtime fikirleri alınmalı |
| Bizim için alınacak ana ders | Mevcut typed/UI-first çekirdeği bozma; üstüne goal/memory/delegation ekle | RAG, tasks/reminders, self-host data stack seçici alınmalı | Goals, skills ürünleşmesi, checkpoints, delegation, gateway güvenliği alınmalı |
| Stratejik risk | Goal/memory katmanı eklenmezse “otonom Jarvis” yerine gelişmiş chat UI’da kalır | Geniş kapsam karmaşıklık/jank riskini artırır | Runtime çok geniş; ürün UX’i masaüstü app kadar odaklı değil |

## Güçlü Yanlar

### `craft-agent`

- Güçlü tip sınırları: TS packages, shared/server/session-tools ayrımı, açık `tool-defs` yapısı.
- Ürün yüzeyi: Electron + web UI + viewer + server ayrı katmanlar halinde duruyor.
- Güvenlik duruşu: permission, sandbox, interceptor, session validation ve shellguard testleri görünüyor.
- Geliştirici ergonomisi: Bun workspace scriptleri hedefli test/typecheck/build akışları sağlıyor.
- Mevcut yön: yerel modifiye dosyalar session-scoped tools ve automations üzerine aktif çalışma olduğunu gösteriyor.

### `odysseus`

- Geniş workspace vizyonu: chat, agent, search, files, notes/tasks, calendar, mail, mobile/PWA.
- Self-hosted duruş: Docker Compose, local-first/privacy-first konumlandırma, ChromaDB/embedding stack.
- Uygulama entegrasyonları: IMAP/SMTP, CalDAV, ntfy/browser/email bildirimleri, lokal veri akışları.
- RAG/search odağı: vector store ve lokal embeddings core dependency olarak geliyor.
- Kullanıcı özellikleri derinliği: saf agent runtime’dan çok “kişisel AI workspace” hissi veriyor.

### `hermes-agent`

- Runtime derinliği: CLI/TUI/gateway, transports/providers, MCP, skills, plugins, tools, memory.
- Otonomi özellikleri: delegation, goals, cron, hooks, checkpoints, worktrees, messaging gateway.
- Cross-platform kurulum: Linux/macOS/WSL2/Termux/native Windows dokümante.
- Genişletilebilirlik: skill/plugin/provider/tool geliştirme açıkça destekleniyor.
- Operasyonel dokümantasyon: security, configuration, sessions/profiles, gateway, MCP, memory dokümanları birinci sınıf.

## Zayıf Yanlar / Boşluklar

### `craft-agent`

- `odysseus` ile kıyaslandığında mail/calendar/notes/tasks/RAG search gibi workspace uygulamaları daha az görünür.
- `hermes-agent` ile kıyaslandığında persistent memory, skills, cron/hooks, gateway messaging ve delegation daha az tamamlanmış ya da daha az ürünleşmiş görünüyor.
- Paketleme güçlü; fakat public install/onboarding hikayesi Hermes/Odysseus kadar öne çıkmıyor.

### `odysseus`

- Çok geniş kapsam mimariyi temiz tutmayı zorlaştırabilir.
- Sınırlar iyi korunmazsa Python monolith eğilimi oluşabilir.
- “More jank and fun” konumlandırması olgunluk/UX tutarlılığı riski taşıyor.
- Agent runtime iç yapısı Hermes’teki core/toolset/plugin katmanları kadar izole görünmüyor.

### `hermes-agent`

- Çok karmaşık sistem yüzeyi: çok sayıda entry point, plugin, skill, provider, gateway, doküman ve test.
- Desktop/product UX ana merkez değil; terminal/gateway akışları baskın.
- Python + Node + çoklu UI build/test/release yüzeyini büyütüyor.
- Hedef basit bir app UX ise güçlü runtime fazla altyapısal hissettirebilir.

## Neyi Örnek Almalı?

### `odysseus` tarafında

- Local-first workspace yol haritası: notes, tasks, scheduled reminders, search/RAG, file library.
- Embeddings/vector memory sistemi birinci sınıf subsystem olmalı; fallback stratejisi bulunmalı.
- “Own hardware, own data” kitlesi için self-hosted Docker Compose hikayesi güçlendirilmeli.
- Mobile/PWA eşitliği sağlanmalı; web UI ikincil yüzey gibi kalmamalı.

### `hermes-agent` tarafında

- Skills yapısı procedural memory olarak formalize edilmeli: `SKILL.md`, progressive disclosure, yeniden kullanılabilir workflowlar.
- Profiles/sessions/context-file dokümantasyonu ve config conventionları netleştirilmeli.
- Automation ürünleştirilmeli: cron, hooks, uzun çalışan goals, delegation, checkpoints/worktrees.
- Gateway adapterları güvenlik modeli netleşince eklenmeli: allowlist, auth, approval, audit logs.
- MCP presetleri ve toolset configuration kullanıcıya dönük kavramlar haline getirilmeli.

## `craft-agent` İçin Önerilen Strateji

1. Mevcut TS/Electron/server mimarisini ana farklılaştırıcı olarak koru; Python monolith’e dönüşme.
2. Önce Hermes runtime primitive’lerini al: skills, profiles, context files, cron/hooks, checkpoints, delegation.
3. Sonra Odysseus workspace özelliklerini seçerek al: RAG search, notes/tasks; calendar/mail sadece ürün kapsamıyla uyumluysa.
4. Automation varsayılan olarak session-scoped ve permission-scoped olmalı; mevcut yerel değişiklikler zaten bu yöne işaret ediyor.
5. Net public install/self-host hikayesi yaz: Electron app, server mode, Docker, model/provider setup, MCP setup.
6. Public capability matrix dokümanı ekle: desktop, web, server, MCP ve automations yüzeylerinde ne çalışıyor net görünsün.

## Hemen Atılacak Adımlar

- Mevcut automation değişikliklerini `session-scoped-tools` ve callback registry testleriyle stabilize et.
- Var olan tool/session mimarisiyle uyumlu bir `skills` spec’i tanımla.
- Geniş workspace uygulamalarına geçmeden önce typed interface arkasında minimal local memory/RAG service ekle.
- Profiles, sessions, tools, permissions, MCP ve automations için doküman taslağı yaz.
- Gateway/messaging konusunu audit/approval sınırları açık hale geldikten sonra değerlendir.

## Jarvis Mimarisine Göre Gerçek Kod Değerlendirmesi

Bu bölüm, yerel kod tabanındaki gerçek yüzeylere göre güncellenmiştir. Önceki değerlendirmedeki bazı noktalar varsayım seviyesindeydi; aşağıdaki maddeler doğrudan mevcut mimari yüzeylere dayanır.

### Bizde Zaten Var Olan Güçlü Runtime Parçaları

| Parça | Gerçek Durum | Jarvis İçin Anlamı |
|---|---|---|
| Session-scoped tool sistemi | `session-scoped-tools.ts` her session için tool instance üretir; callback registry üzerinden session’a özel yetenek bağlar. | Otonom görevleri session bazında izole etmek için güçlü temel hazır. |
| Callback registry | `session-scoped-tool-callback-registry.ts` sessionId keyed `Map` ile `queryFn`, `spawnSessionFn`, `browserPaneFns`, `rightDockFns`, `agentsFns`, `automationsFns` taşır. | Jarvis runtime UI/backend/tool yüzeylerini gevşek bağlı şekilde bağlayabilir. |
| Canonical tool registry | `tool-defs.ts` session tool şemalarını, güvenlik modlarını ve execution mode değerlerini merkezi tutar. | Tool governance ve izin modeli için güçlü typed çekirdek var. |
| Backend-executed tools | `call_llm`, `spawn_session`, `browser_tool`, `right_dock`, `agents`, `automations` backend callback ile çalışır. | UI/desktop yetenekleri agent’a kontrollü biçimde açılabiliyor. |
| Agent profiles | `SessionManager` session oluştururken `mainAgentProfileId`, `activeAgentProfileId`, `skillSlugs`, `delegationMode`, `delegationAllowedAgentIds` alanlarını kullanıyor. | Hermes benzeri profile/skill/delegation temeli zaten başlamış. |
| Automations system | App eventleri ve agent eventleri mevcut; `SchedulerTick`, `SessionStatusChange`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit` gibi tetikleyiciler var. | Jarvis’in olay bazlı kendi kendine çalışma altyapısı başlamış durumda. |
| Automation tools | Agent `automations` tool’u ile automation list/create/update/delete/enable/test/history/replay yapabiliyor. | Agent kendi otomasyonlarını yönetebilir; bu Jarvis mimarisi için kritik güç. |
| Prompt automation | `executePromptAutomation` yeni session oluşturup automation prompt’unu çalıştırıyor. | Arka planda çalışan görev/session modeli için mevcut köprü var. |
| MCP/source sistemi | `McpClient`, `McpClientPool`, source auth/OAuth/credential yapıları var. | Harici araç ekosistemi Jarvis’e bağlanabilir. |
| Messaging gateway | Telegram/WhatsApp/Lark adapter dosyaları ve automation binder yüzeyi var. | Gateway tamamen yok değil; Jarvis bildirim/uzaktan kontrol kanalına evrilebilir. |

### Önceki Varsayımların Düzeltilmiş Hali

| Önceki İfade | Güncel Değerlendirme |
|---|---|
| “Skills eksik/erken” | Tamamen eksik değil. `skills` modeli, validation ve `skillSlugs` profile/session bağlantısı var. Eksik olan: Jarvis düzeyinde skill runtime/discovery/UX ürünleşmesi. |
| “Delegation eksik/erken” | Temel alanlar var: `delegationMode`, `delegationAllowedAgentIds`, `spawn_session`. Eksik olan: güçlü child-agent orchestration, queue, budget, lifecycle UI. |
| “Automation başlıyor” | Başlangıçtan ileri durumda. App/agent eventleri, scheduler tick, prompt/webhook action, history/replay ve agent-facing management tool var. Eksik olan: Jarvis goal engine ve uzun süreli görev state machine. |
| “Gateway yok/erken” | Messaging gateway adapterları ve automation binder var. Eksik olan: güvenli Jarvis command gateway olarak ürünleşme. |
| “Memory zayıf/orta” | Kalıcı semantic/vector memory/RAG yüzeyi hâlâ belirgin değil. Search var, skills/context var; fakat Odysseus/Hermes tarzı persistent memory katmanı ayrı ürünleşmemiş görünüyor. |

### Bizim Mimariye En Uygun Jarvis Evrimi

| Hedef Katman | Bizdeki Mevcut Temel | Eklenmesi Gereken Mimari |
|---|---|---|
| Jarvis Runtime Core | `SessionManager`, session-scoped tools, callback registry | Long-running `Goal`/`TaskRun` state machine; pause/resume/cancel/retry/budget. |
| Jarvis Cockpit UI | Electron/Web UI, right dock tool | Active goals, running sessions, approvals, memory, automation history panelleri. |
| Self-management | `agents` ve `automations` tools | Agent’ın kendi profilini, otomasyonlarını, görevlerini kontrollü düzenleyebilmesi. |
| Delegated workers | `spawn_session`, agent profile delegation alanları | Child session scheduler, parent-child trace, scoped permissions, result merge protocol. |
| Memory/RAG | skills/context/search yüzeyleri | User memory, project memory, session memory, vector index, recall policy. |
| Event engine | Automations event model + `SchedulerTick` | Goal triggers, condition evaluator, retry policy, failure escalation, notification routing. |
| Gateway | messaging adapters + automation binder | Allowlist/auth/audit/approval destekli Jarvis remote command bus. |
| Safety | safeMode, permission mode, sandbox/interceptor yüzeyleri | Checkpoint/rollback, per-goal permission envelope, audit log, irreversible-action guard. |

### Hermes’ten Alınacak Mimari Parçalar

| Hermes Parçası | Bizde Oturacağı Yer | Not |
|---|---|---|
| Persistent memory ayrımı | Yeni memory service + existing session/workspace config | `USER`, project, session, skill memory ayrımı yapılmalı. |
| Goals | `SessionManager` yanına `GoalManager` veya `TaskRunManager` | Session’dan üst seviye orchestration nesnesi olmalı. |
| Hooks/cron | Mevcut automations event engine | Zaten iyi temel var; Hermes fikri burada doğal oturur. |
| Checkpoints/worktrees | Permission/sandbox katmanı + workspace layer | Otonom file edits için şart. |
| Toolsets/presets | `SESSION_TOOL_REGISTRY` + sources/MCP config | UI’dan seçilebilir capability pack haline getirilmeli. |
| Delegation | `spawn_session` + agent profiles | Parent-child task protokolü eklenmeli. |

### Odysseus’tan Alınacak Mimari Parçalar

| Odysseus Parçası | Bizde Oturacağı Yer | Not |
|---|---|---|
| Local-first RAG/vector memory | Yeni memory/RAG package | Jarvis için en önemli eksiklerden biri. |
| Notes/tasks/reminders | Automations + UI cockpit | Önce tasks/reminders; mail/calendar sonraya bırakılmalı. |
| Self-hosted data stack | `Dockerfile.server` + server mode | Chroma/SQLite/Postgres seçenekleri değerlendirilebilir. |
| Mobile/PWA workspace | Web UI | Jarvis remote-control yüzeyi olabilir. |
| File/search workspace | Existing source/search/session tools | Semantic search + permissions ile bağlanmalı. |

### Önceliklendirilmiş Teknik Yol Haritası

| Sıra | İş | Neden |
|---|---|---|
| 1 | `GoalManager` / `TaskRun` modeli tasarla | Jarvis için session üstü otonom hedef nesnesi şart. |
| 2 | Automation tool testlerini güçlendir | Agent’ın kendi automation yönetimi güvenli olmalı. |
| 3 | Parent-child session protokolü ekle | `spawn_session` gerçek delegation altyapısına dönüşür. |
| 4 | Memory/RAG service ekle | Jarvis’in kalıcı bağlamı olmadan otonomi sınırlı kalır. |
| 5 | Cockpit UI panelleri ekle | Kullanıcı arka planda ne çalıştığını görmeli/onaylamalı. |
| 6 | Checkpoint/rollback katmanı ekle | Otonom dosya/sistem aksiyonları güvenli hale gelir. |
| 7 | Gateway’i command bus’a çevir | Mesajlaşma sadece bildirim değil, güvenli uzaktan kontrol olur. |

### Net Sonuç

`craft-agent` beklenenden daha fazla Jarvis altyapısına sahip. En önemli fark: bizim sistemimiz zaten typed tool registry, session-scoped callback registry, agent profiles, skills bağlantısı ve automation management tool ile güçlü bir çekirdek kurmuş. Hermes’ten alınacak şey sıfırdan runtime değil; goal/checkpoint/memory/delegation ürünleşmesi. Odysseus’tan alınacak şey ise geniş app kopyalamak değil; local-first RAG, tasks/reminders ve self-hosted data yaklaşımı.
