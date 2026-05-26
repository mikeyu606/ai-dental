import type { Page } from "playwright-core";

import type {
  BenefitLevelRow,
  DeductibleRow,
  MaximumRow,
} from "@/lib/verify/types";

export type ScrapedMemberFields = {
  patientName?: string;
  planName?: string;
  groupName?: string;
  memberId?: string;
  memberType?: string;
  dateOfBirth?: string;
  groupNumber?: string;
  eligibilityPeriod?: string;
  recordDate?: string;
  provisions?: string[];
};

export type ScrapedBenefitsDetails = ScrapedMemberFields & {
  benefitLevels: BenefitLevelRow[];
  maximums: MaximumRow[];
  deductibles: DeductibleRow[];
};

type RawTableSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

const SECTION_TITLES = {
  benefits: /^benefits overview$/i,
  maximums: /^maximums$/i,
  deductibles: /^deductibles$/i,
} as const;

function normalizeCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractMultilineField(text: string, label: string): string | undefined {
  const pattern = new RegExp(
    `${label}\\s*:?\\s*\\n\\s*([^\\n]+)|${label}\\s*:?\\s*([^\\n]+)`,
    "i",
  );
  const match = text.match(pattern);
  return (match?.[1] ?? match?.[2])?.trim();
}

function parseMemberFieldsFromText(text: string): ScrapedMemberFields {
  return {
    patientName:
      extractMultilineField(text, "Patient name") ??
      extractMultilineField(text, "Name"),
    planName:
      extractMultilineField(text, "Plan") ??
      text.match(/Delta Dental\s+(PPO|Premier|DeltaCare|HMO)[^\n]*/i)?.[0]?.trim(),
    groupName: extractMultilineField(text, "Group"),
    memberId: extractMultilineField(text, "Member ID"),
    memberType: extractMultilineField(text, "Member type"),
    dateOfBirth: extractMultilineField(text, "Date of birth"),
    groupNumber: extractMultilineField(text, "Group number"),
    eligibilityPeriod:
      extractMultilineField(text, "Member eligibility") ??
      text.match(
        /Member eligibility\s*\n?\s*(\d{2}\/\d{2}\/\d{4}\s*-\s*present)/i,
      )?.[1],
    recordDate: text.match(
      /based on our records as of\s+(\d{2}\/\d{2}\/\d{4})/i,
    )?.[1],
  };
}

async function getMainContentLocator(page: Page) {
  return page.locator('[role="main"]').or(page.locator("main")).first();
}

async function waitForBenefitsContent(page: Page): Promise<void> {
  await page
    .getByText(/member eligibility|benefits overview/i)
    .first()
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(() => undefined);
}

async function scrollPageToLoadLazyContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let previous = -1;
    for (let pass = 0; pass < 40; pass++) {
      window.scrollTo(0, document.body.scrollHeight);
      await delay(250);
      if (window.scrollY === previous) break;
      previous = window.scrollY;
    }
    window.scrollTo(0, 0);
    await delay(200);
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await delay(120);
    }
    window.scrollTo(0, 0);
  });
}

async function scrapeTablesBySection(page: Page): Promise<RawTableSection[]> {
  return page.evaluate(() => {
    function normalize(value: string): string {
      return value.replace(/\s+/g, " ").trim();
    }

    function parseHtmlTable(table: HTMLTableElement): {
      headers: string[];
      rows: string[][];
    } {
      const headerCells = table.querySelectorAll("thead th, thead td");
      const headers =
        headerCells.length > 0
          ? [...headerCells].map((c) => normalize(c.textContent ?? ""))
          : [...(table.querySelector("tr")?.querySelectorAll("th, td") ?? [])].map(
              (c) => normalize(c.textContent ?? ""),
            );

      const rows: string[][] = [];
      const bodyRows = table.querySelectorAll("tbody tr");
      const rowList =
        bodyRows.length > 0 ? bodyRows : table.querySelectorAll("tr");

      for (const row of rowList) {
        const cells = [...row.querySelectorAll("td, th")].map((c) =>
          normalize(c.textContent ?? ""),
        );
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }

      if (headers.length > 0 && rows.length > 0 && rows[0].join("|") === headers.join("|")) {
        rows.shift();
      }

      return { headers, rows };
    }

    function parseAriaTable(root: Element): {
      headers: string[];
      rows: string[][];
    } {
      const rows: string[][] = [];
      const rowEls = root.querySelectorAll('[role="row"]');

      for (const row of rowEls) {
        const cells = [
          ...row.querySelectorAll(
            '[role="columnheader"], [role="cell"], [role="gridcell"]',
          ),
        ].map((c) => normalize(c.textContent ?? ""));
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }

      if (rows.length === 0) return { headers: [], rows: [] };

      const firstRowLooksLikeHeader = rows[0].some((c) =>
        /treatment type|^type$|network|amount|used|remaining|ppo|premier/i.test(c),
      );

      if (firstRowLooksLikeHeader) {
        return { headers: rows[0], rows: rows.slice(1) };
      }

      return { headers: [], rows };
    }

    function parseAnyTable(root: Element): {
      headers: string[];
      rows: string[][];
    } | null {
      if (root.tagName === "TABLE") {
        const parsed = parseHtmlTable(root as HTMLTableElement);
        return parsed.rows.length > 0 ? parsed : null;
      }
      if (root.getAttribute("role") === "table") {
        const parsed = parseAriaTable(root);
        return parsed.rows.length > 0 ? parsed : null;
      }
      const htmlTable = root.querySelector("table");
      if (htmlTable) {
        const parsed = parseHtmlTable(htmlTable);
        return parsed.rows.length > 0 ? parsed : null;
      }
      const ariaTable = root.querySelector('[role="table"]');
      if (ariaTable) {
        const parsed = parseAriaTable(ariaTable);
        return parsed.rows.length > 0 ? parsed : null;
      }
      return null;
    }

    function elementOwnText(el: Element): string {
      let text = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent ?? "";
        }
      }
      return normalize(text);
    }

    function findSectionTitleElement(
      root: Element,
      pattern: RegExp,
    ): Element | null {
      const candidates = [...root.querySelectorAll("*")];
      for (const el of candidates) {
        const own = elementOwnText(el);
        const full = normalize(el.textContent ?? "");
        if (own && pattern.test(own) && full.length < 80) return el;
        if (!own && full.length < 60 && pattern.test(full)) return el;
      }
      return null;
    }

    function findTableForSection(titleEl: Element): {
      headers: string[];
      rows: string[][];
    } | null {
      let parent: Element | null = titleEl.parentElement;
      for (let depth = 0; depth < 12 && parent; depth++) {
        const parsed = parseAnyTable(parent);
        if (parsed) return parsed;
        parent = parent.parentElement;
      }

      const allTables = [
        ...document.querySelectorAll("table"),
        ...document.querySelectorAll('[role="table"]'),
      ];

      for (const table of allTables) {
        if (
          titleEl.compareDocumentPosition(table) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          const parsed = parseAnyTable(table);
          if (parsed) return parsed;
        }
      }

      return null;
    }

    const main =
      document.querySelector('[role="main"]') ?? document.querySelector("main");
    if (!main) return [];

    const titlePatterns: { title: string; pattern: RegExp }[] = [
      { title: "Benefits overview", pattern: /^benefits overview$/i },
      { title: "Maximums", pattern: /^maximums$/i },
      { title: "Deductibles", pattern: /^deductibles$/i },
    ];

    const sections: RawTableSection[] = [];

    for (const { title, pattern } of titlePatterns) {
      const titleEl = findSectionTitleElement(main, pattern);
      if (!titleEl) continue;
      const parsed = findTableForSection(titleEl);
      if (!parsed || parsed.rows.length === 0) continue;
      sections.push({ title, headers: parsed.headers, rows: parsed.rows });
    }

    return sections;
  });
}

function parseBenefitLevelsFromText(text: string): BenefitLevelRow[] {
  const section = text.match(
    /benefits overview([\s\S]*?)(?=maximums|deductibles|waiting periods|$)/i,
  )?.[1];
  if (!section) return [];

  const rows: BenefitLevelRow[] = [];
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^(diagnostic|preventive|restorative|endodont|periodont|prosthodont|oral|orthodont|implant|adjunctive)/i.test(line)) {
      continue;
    }
    const percents = lines
      .slice(i + 1, i + 6)
      .filter((l) => /^\d+%/.test(l) || /%\s*-\s*%/.test(l));
    if (percents.length >= 1) {
      rows.push({
        treatmentType: line,
        ppoLevel: percents[0],
        premierLevel: percents[1],
        nonDeltaLevel: percents[2],
      });
    }
  }

  return rows;
}

function parseMaxDedFromText(
  text: string,
  sectionName: "maximums" | "deductibles",
): MaximumRow[] | DeductibleRow[] {
  const pattern =
    sectionName === "maximums"
      ? /maximums([\s\S]*?)(?=deductibles|waiting periods|benefits search|$)/i
      : /deductibles([\s\S]*?)(?=maximums|waiting periods|benefits search|$)/i;
  const section = text.match(pattern)?.[1];
  if (!section) return [];

  const rows: MaximumRow[] = [];
  const blocks = section.split(
    /(?=Calendar Individual Maximum|Lifetime Individual Maximum|Calendar Family Maximum|Deductible)/i,
  );

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 10) continue;

    const amounts = [...trimmed.matchAll(/\$[\d,]+\.\d{2}/g)].map((m) => m[0]);
    if (amounts.length === 0) continue;

    const typeMatch = trimmed.match(
      /^(Calendar Individual Maximum|Lifetime Individual Maximum|Calendar Family Maximum|Deductible[^\n]*)/im,
    );

    rows.push({
      type: normalizeCell(typeMatch?.[1] ?? trimmed.split("\n")[0] ?? "Unknown"),
      treatmentTypes: trimmed.match(
        /(?:Diagnostic|Preventive|Restorative|Endodontics|Periodontics|Prosthodontics)[^.]{10,200}/i,
      )?.[0],
      network: trimmed.match(
        /Delta Dental (?:PPO|Premier)[^.]*|Non-Delta Dental[^.]*/i,
      )?.[0],
      amount: amounts[0],
      used: amounts[1],
      remaining: amounts[2],
    });
  }

  return rows;
}

function headerIndex(headers: string[], patterns: RegExp[]): number {
  const normalized = headers.map((h) => h.toLowerCase());
  for (let i = 0; i < normalized.length; i++) {
    if (patterns.some((p) => p.test(normalized[i]))) {
      return i;
    }
  }
  return -1;
}

function mapBenefitLevels(section: RawTableSection): BenefitLevelRow[] {
  const { headers, rows } = section;
  const treatmentIdx = headerIndex(headers, [/treatment type/i]);
  const ppoIdx = headerIndex(headers, [/ppo/i]);
  const premierIdx = headerIndex(headers, [/premier/i]);
  const nonDeltaIdx = headerIndex(headers, [/non-delta|non delta/i]);

  const mapped = rows.map((row) => ({
    treatmentType: normalizeCell(row[treatmentIdx >= 0 ? treatmentIdx : 0] ?? ""),
    ppoLevel: ppoIdx >= 0 ? normalizeCell(row[ppoIdx]) : undefined,
    premierLevel: premierIdx >= 0 ? normalizeCell(row[premierIdx]) : undefined,
    nonDeltaLevel: nonDeltaIdx >= 0 ? normalizeCell(row[nonDeltaIdx]) : undefined,
  })).filter((r) => r.treatmentType.length > 0);

  if (mapped.length > 0) return mapped;

  if (rows.length > 0 && headers.length === 0) {
    return rows
      .filter((row) => row[0] && !/contract benefit/i.test(row[0]))
      .map((row) => ({
        treatmentType: row[0] ?? "",
        ppoLevel: row[1],
        premierLevel: row[2],
        nonDeltaLevel: row[3],
      }));
  }

  return [];
}

function mapMaximumOrDeductibleRows(
  section: RawTableSection,
): MaximumRow[] | DeductibleRow[] {
  const { headers, rows } = section;
  const typeIdx = headerIndex(headers, [/^type$/i]);
  const treatmentIdx = headerIndex(headers, [/treatment type/i]);
  const networkIdx = headerIndex(headers, [/network/i]);
  const amountIdx = headerIndex(headers, [/amount/i]);
  const usedIdx = headerIndex(headers, [/used/i]);
  const remainingIdx = headerIndex(headers, [/remaining/i]);

  return rows
    .map((row) => ({
      type: normalizeCell(row[typeIdx >= 0 ? typeIdx : 0] ?? ""),
      treatmentTypes:
        treatmentIdx >= 0 ? normalizeCell(row[treatmentIdx]) : undefined,
      network: networkIdx >= 0 ? normalizeCell(row[networkIdx]) : undefined,
      amount: amountIdx >= 0 ? normalizeCell(row[amountIdx]) : undefined,
      used: usedIdx >= 0 ? normalizeCell(row[usedIdx]) : undefined,
      remaining:
        remainingIdx >= 0 ? normalizeCell(row[remainingIdx]) : undefined,
    }))
    .filter((r) => r.type.length > 0 && !/^type$/i.test(r.type));
}

function findSection(
  sections: RawTableSection[],
  pattern: RegExp,
): RawTableSection | undefined {
  return sections.find((s) => pattern.test(s.title));
}

async function scrollToSection(page: Page, pattern: RegExp): Promise<void> {
  const heading = page.getByText(pattern).first();
  if (await heading.isVisible().catch(() => false)) {
    await heading.scrollIntoViewIfNeeded();
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  }
}

async function ensureOverviewTab(page: Page): Promise<void> {
  const overviewTab = page.getByRole("tab", { name: /^overview$/i }).first();
  if (await overviewTab.isVisible().catch(() => false)) {
    await overviewTab.click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
}

async function scrapeMemberFromDom(page: Page): Promise<Partial<ScrapedMemberFields>> {
  return page.evaluate(() => {
    const main =
      document.querySelector('[role="main"]') ?? document.querySelector("main");
    const root = main ?? document.body;
    const result: Partial<ScrapedMemberFields> = {};
    const text = (root.textContent ?? "").replace(/\s+/g, " ");

    const planMatch = text.match(
      /Delta Dental\s+(PPO|Premier|DeltaCare|HMO)[^.\n]*/i,
    );
    if (planMatch) {
      result.planName = planMatch[0].trim();
    }

    const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")];
    for (const heading of headings) {
      const title = (heading.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!title || title.length > 60) continue;
      if (
        /benefits|eligibility|overview|maximum|deductible|plan provisions|waiting|treatment history|family members|add to my patients/i.test(
          title,
        )
      ) {
        continue;
      }
      if (/delta dental|ppo|premier|state regulated/i.test(title)) continue;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(title)) continue;
      if (/^[A-Za-z][\w'.-]*(\s+[A-Za-z][\w'.-]+)+$/.test(title)) {
        result.patientName = title;
        break;
      }
    }

    const bodyText = (root as HTMLElement).innerText ?? "";
    const labelPatterns: [
      Exclude<keyof ScrapedMemberFields, "provisions">,
      RegExp,
      RegExp,
    ][] = [
      ["memberType", /^Member type$/im, /^Member type\s*\n\s*(.+)$/im],
      ["dateOfBirth", /^Date of birth$/im, /^Date of birth\s*\n\s*(.+)$/im],
      ["memberId", /^Member ID$/im, /^Member ID\s*\n\s*(.+)$/im],
      ["groupNumber", /^Group number$/im, /^Group number\s*\n\s*(.+)$/im],
      [
        "eligibilityPeriod",
        /^Member eligibility$/im,
        /^Member eligibility\s*\n\s*(.+)$/im,
      ],
      ["groupName", /^Group$/im, /^Group\s*\n\s*(.+)$/im],
    ];

    for (const [key, , valuePattern] of labelPatterns) {
      const match = bodyText.match(valuePattern);
      if (match?.[1]) {
        result[key] = match[1].replace(/\s+/g, " ").trim();
      }
    }

    const provisionsTitle = [...root.querySelectorAll("*")].find((el) => {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return /^provisions$/i.test(text);
    });

    if (provisionsTitle) {
      const container =
        provisionsTitle.closest("section") ??
        provisionsTitle.parentElement ??
        root;

      const items = [
        ...container.querySelectorAll("li"),
      ]
        .map((li) => (li.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      if (items.length > 0) {
        result.provisions = Array.from(new Set(items)).slice(0, 50);
      } else {
        // Fallback: treat newline bullet text as provisions
        const after = bodyText.split(/provisions/i)[1] ?? "";
        const candidates = after
          .split("\n")
          .map((line) => line.replace(/^[•\-\u2022]\s*/, "").trim())
          .filter((line) => line.length >= 6);
        if (candidates.length > 0) {
          result.provisions = candidates.slice(0, 50);
        }
      }
    }

    return result;
  });
}

async function revealDeductiblesSection(page: Page): Promise<void> {
  await ensureOverviewTab(page);
  await scrollToSection(page, /^maximums$/i);
  await scrollToSection(page, /^deductibles$/i);

  const deductiblesHeading = page.getByText(/^deductibles$/i).first();

  if (await deductiblesHeading.isVisible().catch(() => false)) {
    return;
  }

  const planTab = page.getByRole("tab", { name: /plan provisions/i }).first();
  if (await planTab.isVisible().catch(() => false)) {
    await planTab.click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await scrollToSection(page, /deductible/i);
  }
}

export async function scrapeEligibilityBenefits(
  page: Page,
): Promise<ScrapedBenefitsDetails> {
  const main = await getMainContentLocator(page);
  await main.waitFor({ state: "visible", timeout: 60_000 });
  await waitForBenefitsContent(page);

  await ensureOverviewTab(page);
  await scrollToSection(page, /benefits overview/i);
  await scrollPageToLoadLazyContent(page);
  await revealDeductiblesSection(page);
  await scrollPageToLoadLazyContent(page);

  const summaryText = (await main.innerText()).trim();
  const memberFromText = parseMemberFieldsFromText(summaryText);
  const memberFromDom = await scrapeMemberFromDom(page);
  const sections = await scrapeTablesBySection(page);

  const benefitsSection =
    findSection(sections, SECTION_TITLES.benefits) ??
    sections.find(
      (s) =>
        s.headers.some((h) => /treatment type/i.test(h)) &&
        s.headers.some((h) => /ppo/i.test(h)),
    );

  const maximumsSection = findSection(sections, SECTION_TITLES.maximums);
  const deductiblesSection = findSection(sections, SECTION_TITLES.deductibles);

  const benefitLevelsFromTable = benefitsSection
    ? mapBenefitLevels(benefitsSection)
    : [];
  const benefitLevels =
    benefitLevelsFromTable.length > 0
      ? benefitLevelsFromTable
      : parseBenefitLevelsFromText(summaryText);

  const maximumsFromTable = maximumsSection
    ? (mapMaximumOrDeductibleRows(maximumsSection) as MaximumRow[])
    : [];
  const maximums =
    maximumsFromTable.length > 0
      ? maximumsFromTable
      : (parseMaxDedFromText(summaryText, "maximums") as MaximumRow[]);

  const deductiblesFromTable = deductiblesSection
    ? (mapMaximumOrDeductibleRows(deductiblesSection) as DeductibleRow[])
    : [];
  const deductibles =
    deductiblesFromTable.length > 0
      ? deductiblesFromTable
      : (parseMaxDedFromText(summaryText, "deductibles") as DeductibleRow[]);

  return {
    patientName: memberFromDom.patientName ?? memberFromText.patientName,
    planName: memberFromDom.planName ?? memberFromText.planName,
    groupName: memberFromDom.groupName ?? memberFromText.groupName,
    memberId: memberFromDom.memberId ?? memberFromText.memberId,
    memberType: memberFromDom.memberType ?? memberFromText.memberType,
    dateOfBirth: memberFromDom.dateOfBirth ?? memberFromText.dateOfBirth,
    groupNumber: memberFromDom.groupNumber ?? memberFromText.groupNumber,
    eligibilityPeriod:
      memberFromDom.eligibilityPeriod ?? memberFromText.eligibilityPeriod,
    recordDate: memberFromText.recordDate,
    provisions: memberFromDom.provisions,
    benefitLevels,
    maximums,
    deductibles,
  };
}
