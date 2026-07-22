export type ResolvableComponent = {
  id: string;
  name: string;
  code: string;
  sortOrder?: number | null;
  weight?: unknown;
  isActive?: boolean;
};

export type ResolvableSubjectComponent = {
  id: string;
  name: string;
  code: string;
  components?: ResolvableComponent[];
};

export type ResolvedSubjectComponent = {
  subject: ResolvableSubjectComponent | null;
  component: ResolvableComponent | null;
  componentName: string | null;
  componentCode: string;
  componentKey: string;
};

function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 && /^(bot|mot|eot)$/i.test(part) ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`))
    .join(" ");
}

export function normalizeSubjectComponentName(value: string): string {
  const clean = norm(value);
  if (!clean) return "";
  const paperMatch = clean.match(/^(?:paper\s*)?(\d+)$/i);
  if (paperMatch) return `Paper ${paperMatch[1]}`;
  const compactPaper = clean.match(/^p(?:aper)?\s*(\d+)$/i);
  if (compactPaper) return `Paper ${compactPaper[1]}`;
  return titleCase(clean);
}

export function subjectComponentCode(value: string): string {
  return normalizeSubjectComponentName(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findComponent(
  subject: ResolvableSubjectComponent,
  componentName: string,
): ResolvableComponent | null {
  const normalizedName = norm(componentName);
  const normalizedCode = norm(subjectComponentCode(componentName));
  return subject.components?.find((component) => {
    if (component.isActive === false) return false;
    return norm(component.name) === normalizedName || norm(component.code) === normalizedCode;
  }) ?? null;
}

function matchSubjectByExactText(subjects: ResolvableSubjectComponent[], value: string) {
  const normalized = norm(value);
  return subjects.find((subject) => norm(subject.name) === normalized || norm(subject.code) === normalized) ?? null;
}

function matchSubjectPrefix(subjects: ResolvableSubjectComponent[], value: string) {
  const normalized = norm(value);
  const candidates = subjects
    .flatMap((subject) => [
      { subject, key: norm(subject.name) },
      { subject, key: norm(subject.code) },
    ])
    .filter(({ key }) => key && normalized.startsWith(`${key} `))
    .sort((a, b) => b.key.length - a.key.length);

  const match = candidates[0];
  if (!match) return null;
  return {
    subject: match.subject,
    suffix: normalized.slice(match.key.length).trim(),
  };
}

export function resolveSubjectComponent(
  subjects: ResolvableSubjectComponent[],
  rawSubject: string,
  rawComponent?: string | null,
): ResolvedSubjectComponent {
  const explicitComponent = normalizeSubjectComponentName(rawComponent ?? "");
  const exactSubject = matchSubjectByExactText(subjects, rawSubject);

  if (exactSubject) {
    const component = explicitComponent ? findComponent(exactSubject, explicitComponent) : null;
    return {
      subject: exactSubject,
      component,
      componentName: explicitComponent || null,
      componentCode: explicitComponent ? subjectComponentCode(explicitComponent) : "",
      componentKey: component?.id ?? "",
    };
  }

  const prefixMatch = matchSubjectPrefix(subjects, rawSubject);
  if (!prefixMatch) {
    return { subject: null, component: null, componentName: null, componentCode: "", componentKey: "" };
  }

  const componentName = explicitComponent || normalizeSubjectComponentName(prefixMatch.suffix);
  const component = componentName ? findComponent(prefixMatch.subject, componentName) : null;
  return {
    subject: prefixMatch.subject,
    component,
    componentName: componentName || null,
    componentCode: componentName ? subjectComponentCode(componentName) : "",
    componentKey: component?.id ?? "",
  };
}
