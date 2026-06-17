# 대한민국 국회 AI 챗봇

국회 공공 API를 기반으로 한 AI 챗봇입니다.

## 아키텍처

```
GitHub Pages (프론트엔드) → Cloudflare Worker (AI 프록시) → 국회 공공 API
```

## 배포

| 구성 | 서비스 | 경로 |
|---|---|---|
| 프론트엔드 | GitHub Pages | `frontend/` |
| AI 백엔드 | Cloudflare Worker | `worker/` |

## Cloudflare Worker 설정

### 1. Secrets 등록

```bash
cd worker
npx wrangler secret put ASSEMBLY_API_KEY
npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put NABO_API_KEY
npx wrangler secret put LAWMAKING_OC
npx wrangler secret put AI_INTEGRATIONS_OPENAI_BASE_URL
npx wrangler secret put AI_INTEGRATIONS_OPENAI_API_KEY
```

### 2. 배포

```bash
cd worker
npm install
npm run deploy
```

### 3. Worker URL 확인 후 GitHub Actions 변수 설정

GitHub 레포 → Settings → Variables → `VITE_API_URL` 에 Worker URL 입력

## GitHub Actions

- `worker/.github/workflows/deploy.yml` — Worker 자동 배포 (main 브랜치 push 시)
- `.github/workflows/pages.yml` — GitHub Pages 자동 배포 (main 브랜치 push 시)

## 지원 도구 (hollobit/assembly-api-mcp v0.7.0 기반)

1. `get_assembly_members` — 국회의원 목록
2. `get_bills` — 22대 국회 의안
3. `get_vote_results` — 표결 결과
4. `get_assembly_schedule` — 국회 일정
5. `get_petitions` — 청원
6. `get_committee_proceedings` — 위원회 심사
7. `get_legislation_notices` — 입법예고
8. `get_committee_info` — 위원회 현황
9. `get_nabo_reports` — 국회예산정책처 보고서
10. `get_lawmaking_notices` — 국민참여입법센터
11. `search_korean_law` — 법제처 법령 검색
12. `search_member_activity` — 의원 의정활동 **(신규)**
13. `get_bill_review` — 의안 심사 정보 **(신규)**
14. `search_research_reports` — 국회입법조사처 보고서 **(신규)**
15. `search_library` — 국회도서관 자료 검색 **(신규)**
16. `get_budget_analysis` — 국회예산정책처 분석 자료 **(신규)**
