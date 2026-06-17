/**
 * 국회 AI 챗봇 — Cloudflare Worker
 * 현재 백엔드(chat.ts) 로직을 Worker로 포팅 + hollobit v0.7.0 신규 도구 반영
 */

export interface Env {
  ASSEMBLY_API_KEY: string;
  MINIMAX_API_KEY: string;
  NABO_API_KEY: string;
  LAWMAKING_OC: string;
  AI_INTEGRATIONS_OPENAI_BASE_URL: string;
  AI_INTEGRATIONS_OPENAI_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

const ASSEMBLY_BASE = "https://open.assembly.go.kr/portal/openapi";
const NABO_BASE = "https://www.nabo.go.kr";
const LAWMAKING_BASE = "https://opinion.lawmaking.go.kr/rest";
const LAW_BASE = "https://www.law.go.kr/DRF";

// ── 도구 정의 ────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_assembly_members",
      description: "국회의원 기본 정보를 조회합니다. 이름(HG_NM), 소속 정당(POLY_NM), 선거구(ORIG_NM), 위원회(CMIT_NM), 당선 횟수, 연락처 등의 정보를 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 100, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bills",
      description: "국회에 제출된 법률안(의안) 목록을 조회합니다. 22대 국회 의안 목록, 법안 제목(BILL_NAME), 제안일(PROPOSE_DT), 처리 상태(PROC_RESULT), BILL_ID 등을 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          bill_name: { type: "string", description: "법안 이름 키워드로 검색 (선택사항)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vote_results",
      description: "22대 국회의원들의 법안별 표결 결과 집계를 조회합니다. 가결/부결 여부, 찬성(YES_TCNT)/반대(NO_TCNT)/기권(BLANK_TCNT)/총 투표수(VOTE_TCNT) 정보를 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          bill_name: { type: "string", description: "검색할 법안 이름 키워드 (선택사항)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assembly_schedule",
      description: "국회 일정을 조회합니다. 본회의, 위원회, 세미나, 국회행사 등의 일정을 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          schedule_type: { type: "string", description: "일정 종류 필터 (예: '본회의', '위원회', '세미나', '국회행사') (선택사항)" },
          date: { type: "string", description: "날짜 또는 연도 필터 (예: '2026', '2026-04') (선택사항)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_petitions",
      description: "국회에 접수된 청원(국민동의청원 포함) 목록과 심사 정보를 조회합니다.",
      parameters: {
        type: "object",
        properties: {
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_committee_proceedings",
      description: "상임위원회에서 처리된 의안 목록을 조회합니다. 22대 국회의 위원회별 의안 심사 현황을 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_legislation_notices",
      description: "현재 진행 중인 입법예고 목록을 조회합니다. 법안이 제출되기 전 국민 의견 수렴을 위해 공고되는 단계입니다.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드 (법안명 검색, 선택사항)" },
          date_from: { type: "string", description: "시작일 (YYYY-MM-DD, 선택사항)" },
          date_to: { type: "string", description: "종료일 (YYYY-MM-DD, 선택사항)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_committee_info",
      description: "국회 상임위원회 및 특별위원회 현황 목록을 조회합니다. 위원회명, 위원장, 위원 수 등 정보를 제공합니다.",
      parameters: {
        type: "object",
        properties: {
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 30, 최대: 100)" },
          page_index: { type: "number", description: "페이지 번호 (기본값: 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nabo_reports",
      description: "국회예산정책처(NABO) 보고서 및 정기간행물을 검색합니다. 예산·경제·세제 분석 보고서를 키워드로 검색할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "검색 대상: 'report'(보고서, 기본값), 'periodical'(정기간행물)",
            enum: ["report", "periodical"],
          },
          keyword: { type: "string", description: "검색어 (선택사항)" },
          page: { type: "number", description: "페이지 번호 (기본값: 1)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 50)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lawmaking_notices",
      description: "국민참여입법센터(lawmaking.go.kr)의 입법예고 목록을 조회합니다. 정부 부처가 추진 중인 법령 입법예고 또는 행정예고를 검색할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "검색 대상: 'legislation'(입법예고, 기본값), 'admin'(행정예고)",
            enum: ["legislation", "admin"],
          },
          keyword: { type: "string", description: "검색어 (선택사항)" },
          page: { type: "number", description: "페이지 번호 (기본값: 1)" },
          page_size: { type: "number", description: "조회할 데이터 개수 (기본값: 10, 최대: 50)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_korean_law",
      description: "법제처(law.go.kr) 법령을 검색합니다. 법령명으로 현행 법률, 대통령령, 부령 등을 검색합니다.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "검색할 법령명 (예: '민법', '근로기준법', '국회법')" },
          display: { type: "number", description: "최대 결과 개수 (기본값: 10, 최대: 100)" },
        },
        required: ["query"],
      },
    },
  },
  // ── hollobit v0.7.0 신규 도구 ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "search_member_activity",
      description: "국회의원의 의정활동을 검색합니다. 이름으로 발의 법안 목록과 본회의 표결 참여 정보를 조합하여 반환하거나, 키워드로 관련 의안을 발의한 의원을 검색합니다.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "의원 이름 (정확한 이름). name 또는 keyword 중 하나는 필수" },
          keyword: { type: "string", description: "검색 키워드 (의안명 검색). name 없이 사용 시 해당 키워드 관련 의안 발의자 요약을 반환" },
          activity_type: {
            type: "string",
            enum: ["all", "bills", "votes"],
            description: "활동 유형 (all=전체, bills=발의법안, votes=표결참여, 기본: all)",
          },
          page_size: { type: "number", description: "페이지 크기 (기본: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bill_review",
      description: "의안의 심사 경과 정보를 조회합니다. 의안ID 또는 의안명으로 검색할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          bill_id: { type: "string", description: "의안 ID" },
          bill_name: { type: "string", description: "의안명 (부분 일치 검색)" },
          page_size: { type: "number", description: "페이지 크기 (기본: 20, 최대: 100)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_research_reports",
      description: "국회입법조사처의 보고서를 검색합니다. 키워드와 보고서 유형으로 필터링할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드" },
          type: {
            type: "string",
            enum: ["이슈와논점", "현안분석", "입법정책보고서"],
            description: "보고서 유형",
          },
          page: { type: "number", description: "페이지 번호 (기본: 1)" },
          page_size: { type: "number", description: "페이지 크기 (기본: 20, 최대: 100)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_library",
      description: "국회도서관 자료를 검색합니다. 키워드로 도서, 논문, 간행물 등을 검색할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드 (필수)" },
          type: { type: "string", description: "자료 유형 (예: 도서, 논문, 간행물)" },
          page: { type: "number", description: "페이지 번호 (기본: 1)" },
          page_size: { type: "number", description: "페이지 크기 (기본: 20, 최대: 100)" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_analysis",
      description: "국회예산정책처(NABO)의 경제·재정 분석 자료를 조회합니다. 키워드, 연도, 카테고리로 필터링할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드" },
          year: { type: "string", description: "발행 연도 (예: 2024)" },
          category: { type: "string", description: "자료 카테고리" },
          page: { type: "number", description: "페이지 번호 (기본: 1)" },
          page_size: { type: "number", description: "페이지 크기 (기본: 20, 최대: 100)" },
        },
        required: [],
      },
    },
  },
];

const SYSTEM_PROMPT = `당신은 대한민국 국회 및 법령 정보를 제공하는 AI 어시스턴트입니다. MiniMax M2.7 모델 기반이며, 국회 데이터는 assembly-api-mcp(hollobit) 및 korean-law-mcp(chrisryugj) 참조 구현을 통해 조회합니다.

사용 가능한 도구:
1. get_assembly_members: 국회의원 목록 조회 (이름, 정당, 위원회, 선거구).
2. get_bills: 22대 국회 법안 목록 조회.
3. get_vote_results: 22대 국회 법안별 표결 결과.
4. get_assembly_schedule: 국회 일정 (본회의, 위원회, 행사 등).
5. get_petitions: 국회 청원 목록 및 심사 정보.
6. get_committee_proceedings: 상임위원회 의안 심사 현황.
7. get_legislation_notices: 진행 중인 입법예고 목록.
8. get_committee_info: 국회 위원회 현황.
9. get_nabo_reports: 국회예산정책처(NABO) 보고서/정기간행물 검색.
10. get_lawmaking_notices: 국민참여입법센터 입법예고·행정예고.
11. search_korean_law: 법제처 법령 검색.
12. search_member_activity: 특정 의원의 의정활동 조회 (발의 법안 + 표결 참여).
13. get_bill_review: 의안 심사 경과 정보 조회.
14. search_research_reports: 국회입법조사처 보고서 검색.
15. search_library: 국회도서관 자료 검색.
16. get_budget_analysis: 국회예산정책처 경제·재정 분석 자료 조회.

중요 지침:
- 항상 한국어로 답변하세요.
- 데이터를 조회할 때는 반드시 도구를 사용하세요.
- 결과를 표나 목록 형태로 정리하여 제공하세요.
- 특정 위원회 소속 의원: get_assembly_members 결과를 CMIT_NM으로 필터링.
- 특정 의원 활동: search_member_activity 사용.
- 국가 재정·예산 질문: get_nabo_reports 또는 get_budget_analysis 사용.
- 정부 입법 동향: get_lawmaking_notices 사용.
- 특정 법률 내용 검색: search_korean_law 사용.
- 데이터가 없거나 오류 시 사용자에게 친절하게 안내하세요.`;

// ── API 헬퍼 함수 ────────────────────────────────────────────────────────────

function extractAssemblyRows(data: unknown, apiCode: string): unknown {
  try {
    const dataObj = data as Record<string, unknown>;
    const apiData = dataObj[apiCode] as Array<Record<string, unknown>>;
    if (!apiData || !Array.isArray(apiData)) {
      const result = (dataObj as Record<string, unknown>)?.RESULT as Record<string, unknown> | undefined;
      const code = result?.CODE as string | undefined;
      const message = result?.MESSAGE as string | undefined;
      if (code && code !== "INFO-000") return { error: `API 오류 (${code}): ${message}` };
      return data;
    }
    const headInfo = apiData[0] as Record<string, unknown>;
    const rowInfo = apiData[1] as Record<string, unknown>;
    const headArray = headInfo?.head as Array<Record<string, unknown>>;
    const result = headArray?.[1]?.RESULT as Record<string, unknown> | undefined;
    const code = result?.CODE as string | undefined;
    const message = result?.MESSAGE as string | undefined;
    if (code && code !== "INFO-000") return { error: `API 오류 (${code}): ${message}` };
    const rows = rowInfo?.row as unknown[];
    const totalCount = (headArray?.[0] as Record<string, unknown> | undefined)?.list_total_count;
    return { totalCount, rows: rows || [] };
  } catch {
    return data;
  }
}

async function callAssemblyApi(
  endpoint: string,
  params: Record<string, string | number>,
  apiKey: string,
): Promise<unknown> {
  const qs = new URLSearchParams({ Type: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${ASSEMBLY_BASE}/${endpoint}?${qs}&KEY=${apiKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Assembly API HTTP error: ${res.status}`);
  return res.json();
}

async function callNaboApi(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  naboKey: string,
): Promise<unknown> {
  const filtered: Record<string, string> = { key: naboKey };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") filtered[k] = String(v);
  }
  const qs = Object.entries(filtered).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const url = `${NABO_BASE}${endpoint}?${qs}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`NABO API HTTP error: ${res.status}`);
  return res.json();
}

async function callLawmakingApi(
  endpoint: string,
  params: Record<string, string | number>,
  oc: string,
): Promise<string> {
  const qs = new URLSearchParams({ OC: oc, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${LAWMAKING_BASE}/${endpoint}?${qs}`;
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Lawmaking API HTTP error: ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("국민참여입법센터 API 접근이 제한되었습니다. IP 화이트리스트(opinion.lawmaking.go.kr) 등록이 필요합니다.");
  }
  return text;
}

async function callKoreanLawApi(query: string, display: number, oc: string): Promise<unknown> {
  const qs = new URLSearchParams({ OC: oc, target: "law", type: "JSON", query, display: String(Math.min(display, 100)) });
  const url = `${LAW_BASE}/lawSearch.do?${qs}`;
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`법제처 API HTTP error: ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("법제처 API 접근이 제한되었습니다. IP 화이트리스트(law.go.kr) 등록이 필요합니다.");
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ── 도구 실행 ────────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>, env: Env): Promise<string> {
  const pageSize = (args.page_size as number) || 10;
  const pageIndex = (args.page_index as number) || 1;

  try {
    if (name === "get_assembly_members") {
      const data = await callAssemblyApi("nwvrqwxyaytdsfvhu", { pSize: Math.min(pageSize, 100), pIndex: pageIndex }, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nwvrqwxyaytdsfvhu"), null, 2);
    }
    if (name === "get_bills") {
      const params: Record<string, string | number> = { pSize: Math.min(pageSize, 100), pIndex: pageIndex, AGE: 22 };
      if (args.bill_name) params.BILL_NM = args.bill_name as string;
      const data = await callAssemblyApi("nzmimeepazxkubdpn", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nzmimeepazxkubdpn"), null, 2);
    }
    if (name === "get_vote_results") {
      const params: Record<string, string | number> = { pSize: Math.min(pageSize, 100), pIndex: pageIndex, AGE: 22 };
      if (args.bill_name) params.BILL_NAME = args.bill_name as string;
      const data = await callAssemblyApi("ncocpgfiaoituanbr", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "ncocpgfiaoituanbr"), null, 2);
    }
    if (name === "get_assembly_schedule") {
      const params: Record<string, string | number> = { pSize: Math.min(pageSize, 100), pIndex: pageIndex };
      if (args.schedule_type) params.SCH_KIND = args.schedule_type as string;
      if (args.date) params.SCH_DT = args.date as string;
      const data = await callAssemblyApi("ALLSCHEDULE", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "ALLSCHEDULE"), null, 2);
    }
    if (name === "get_petitions") {
      const data = await callAssemblyApi("PTTJUDGE", { pSize: Math.min(pageSize, 100), pIndex: pageIndex }, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "PTTJUDGE"), null, 2);
    }
    if (name === "get_committee_proceedings") {
      const data = await callAssemblyApi("nwbpacrgavhjryiph", { pSize: Math.min(pageSize, 100), pIndex: pageIndex, AGE: 22 }, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nwbpacrgavhjryiph"), null, 2);
    }
    if (name === "get_legislation_notices") {
      const params: Record<string, string | number> = { pSize: Math.min(pageSize, 100), pIndex: pageIndex };
      if (args.keyword) params.BILL_NAME = args.keyword as string;
      if (args.date_from) params.START_DT = args.date_from as string;
      if (args.date_to) params.END_DT = args.date_to as string;
      const data = await callAssemblyApi("nknalejkafmvgzmpt", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nknalejkafmvgzmpt"), null, 2);
    }
    if (name === "get_committee_info") {
      const data = await callAssemblyApi("nxrvzonlafugpqjuh", { pSize: Math.min(pageSize, 100), pIndex: pageIndex }, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nxrvzonlafugpqjuh"), null, 2);
    }
    if (name === "get_nabo_reports") {
      const endpoint = (args.type as string) === "periodical" ? "/api/v1/periodical.do" : "/api/v1/report.do";
      const data = await callNaboApi(endpoint, {
        page: (args.page as number) || 1,
        size: Math.min((args.page_size as number) || 10, 50),
        scSort: "pubDt",
        scOrder: "desc",
        scSw: (args.keyword as string) || undefined,
      }, env.NABO_API_KEY);
      return JSON.stringify(data, null, 2);
    }
    if (name === "get_lawmaking_notices") {
      const endpoint = (args.type as string) === "admin" ? "ptcpAdmPp" : "ogLmPp";
      const params: Record<string, string | number> = {
        pageIndex: (args.page as number) || 1,
        pageSize: Math.min((args.page_size as number) || 10, 50),
      };
      if (args.keyword) params.searchWrd = args.keyword as string;
      return await callLawmakingApi(endpoint, params, env.LAWMAKING_OC);
    }
    if (name === "search_korean_law") {
      const data = await callKoreanLawApi(args.query as string, (args.display as number) || 10, env.LAWMAKING_OC || "neoulneoul");
      return JSON.stringify(data, null, 2);
    }
    // ── hollobit v0.7.0 신규 도구 ──────────────────────────────────────────
    if (name === "search_member_activity") {
      if (!args.name && !args.keyword) return JSON.stringify({ error: "name 또는 keyword 중 하나는 필수입니다." });
      const ps = Math.min((args.page_size as number) || 10, 100);
      if (!args.name && args.keyword) {
        const data = await callAssemblyApi("nzmimeepazxkubdpn", { AGE: 22, BILL_NAME: args.keyword as string, pSize: ps }, env.ASSEMBLY_API_KEY);
        const extracted = extractAssemblyRows(data, "nzmimeepazxkubdpn") as { rows?: Record<string, unknown>[] };
        const rows = extracted?.rows || [];
        const proposerMap = new Map<string, { count: number; bills: string[] }>();
        for (const row of rows) {
          const proposer = String(row.PROPOSER ?? "알수없음");
          const entry = proposerMap.get(proposer) ?? { count: 0, bills: [] };
          entry.count += 1;
          if (entry.bills.length < 3) entry.bills.push(String(row.BILL_NAME ?? ""));
          proposerMap.set(proposer, entry);
        }
        const items = Array.from(proposerMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
          .map(([pName, info]) => ({ proposer: pName, billCount: info.count, sampleBills: info.bills }));
        return JSON.stringify({ keyword: args.keyword, proposerSummary: items });
      }
      const activityType = (args.activity_type as string) || "all";
      const results: Record<string, unknown> = { name: args.name };
      if (activityType === "all" || activityType === "bills") {
        const data = await callAssemblyApi("nzmimeepazxkubdpn", { AGE: 22, PROPOSER: args.name as string, pSize: ps }, env.ASSEMBLY_API_KEY);
        results.bills = extractAssemblyRows(data, "nzmimeepazxkubdpn");
      }
      if (activityType === "all" || activityType === "votes") {
        const data = await callAssemblyApi("ncocpgfiaoituanbr", { AGE: 22, pSize: ps }, env.ASSEMBLY_API_KEY);
        results.votes = extractAssemblyRows(data, "ncocpgfiaoituanbr");
      }
      return JSON.stringify(results, null, 2);
    }
    if (name === "get_bill_review") {
      const params: Record<string, string | number> = { pSize: Math.min((args.page_size as number) || 20, 100) };
      if (args.bill_id) params.BILL_ID = args.bill_id as string;
      if (args.bill_name) params.BILL_NM = args.bill_name as string;
      const data = await callAssemblyApi("BILLJUDGE", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "BILLJUDGE"), null, 2);
    }
    if (name === "search_research_reports") {
      const params: Record<string, string | number> = {};
      if (args.keyword) params.KEYWORD = args.keyword as string;
      if (args.type) params.TYPE = args.type as string;
      if (args.page) params.pIndex = args.page as number;
      if (args.page_size) params.pSize = Math.min(args.page_size as number, 100);
      const data = await callAssemblyApi("naaborihbkorknasp", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "naaborihbkorknasp"), null, 2);
    }
    if (name === "search_library") {
      const params: Record<string, string | number> = { KEYWORD: args.keyword as string };
      if (args.type) params.TYPE = args.type as string;
      if (args.page) params.pIndex = args.page as number;
      if (args.page_size) params.pSize = Math.min(args.page_size as number, 100);
      const data = await callAssemblyApi("nywrpgoaatcpoqbiy", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "nywrpgoaatcpoqbiy"), null, 2);
    }
    if (name === "get_budget_analysis") {
      const params: Record<string, string | number> = {};
      if (args.keyword) params.KEYWORD = args.keyword as string;
      if (args.year) params.YEAR = args.year as string;
      if (args.category) params.CATEGORY = args.category as string;
      if (args.page) params.pIndex = args.page as number;
      if (args.page_size) params.pSize = Math.min(args.page_size as number, 100);
      const data = await callAssemblyApi("OZN379001174FW17905", params, env.ASSEMBLY_API_KEY);
      return JSON.stringify(extractAssemblyRows(data, "OZN379001174FW17905"), null, 2);
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Worker 핸들러 ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : (origin.includes("github.io") || origin.includes("localhost") ? origin : allowedOrigin),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/healthz") {
      return Response.json({ status: "ok" }, { headers: corsHeaders });
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    try {
      const body = await request.json() as { messages: Array<{ role: string; content: string }> };
      const { messages } = body;

      const openaiBase = env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      const openaiKey = env.AI_INTEGRATIONS_OPENAI_API_KEY || env.MINIMAX_API_KEY;

      const chatMessages: Array<Record<string, unknown>> = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const collectedToolCalls: Array<{ name: string; arguments: string; result: string }> = [];
      let finalMessage = "";
      let continueLoop = true;
      let iterCount = 0;
      const maxIter = 8;

      while (continueLoop && iterCount < maxIter) {
        iterCount++;

        const aiRes = await fetch(`${openaiBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-5.2",
            max_completion_tokens: 8192,
            messages: chatMessages,
            tools: TOOLS,
            tool_choice: "auto",
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          return Response.json({ error: `AI API 오류: ${aiRes.status} — ${errText}` }, { status: 500, headers: corsHeaders });
        }

        const aiData = await aiRes.json() as {
          choices: Array<{
            message: {
              content?: string;
              tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
            };
          }>;
        };

        const choice = aiData.choices?.[0];
        if (!choice) {
          return Response.json({ error: "AI로부터 응답을 받지 못했습니다." }, { status: 500, headers: corsHeaders });
        }

        const assistantMsg = choice.message;

        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          chatMessages.push({ role: "assistant", tool_calls: assistantMsg.tool_calls, content: assistantMsg.content ?? null });
          for (const tc of assistantMsg.tool_calls) {
            if (tc.type !== "function") continue;
            let tcArgs: Record<string, unknown> = {};
            try { tcArgs = JSON.parse(tc.function.arguments); } catch { tcArgs = {}; }
            const result = await executeTool(tc.function.name, tcArgs, env);
            collectedToolCalls.push({ name: tc.function.name, arguments: tc.function.arguments, result });
            chatMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
        } else {
          finalMessage = assistantMsg.content || "";
          continueLoop = false;
        }
      }

      if (!finalMessage) finalMessage = "죄송합니다, 응답을 생성하지 못했습니다.";

      return Response.json(
        { message: { role: "assistant", content: finalMessage }, toolCalls: collectedToolCalls },
        { headers: corsHeaders },
      );
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500, headers: corsHeaders },
      );
    }
  },
};
