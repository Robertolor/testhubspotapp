export interface MappingValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface HubspotPropertyRef {
  name: string;
  type: string;
  readOnly: boolean;
}

export interface MindbodyFieldRef {
  key: string;
  type: string;
}

export interface MappingRowRef {
  hubspotProperty: string;
  mindbodyField: string;
  isSystem?: boolean;
}

type NormalizedFieldType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "enumeration"
  | "unknown";

/** Required contact pairs — must stay mapped for sync to work. */
export const SYSTEM_CONTACT_MAPPING_PAIRS: MappingRowRef[] = [
  { hubspotProperty: "email", mindbodyField: "Email", isSystem: true },
  { hubspotProperty: "mindbody_client_id", mindbodyField: "Id", isSystem: true },
];

/** Deal identity fields (enforced when present as is_system rows). */
export const SYSTEM_DEAL_MAPPING_PAIRS: MappingRowRef[] = [
  { hubspotProperty: "mindbody_sale_id", mindbodyField: "saleId", isSystem: true },
  {
    hubspotProperty: "mindbody_contract_id",
    mindbodyField: "clientContractId",
    isSystem: true,
  },
];

function emptyResult(): MappingValidationResult {
  return { ok: true, errors: [], warnings: [] };
}

function mergeResults(
  ...results: MappingValidationResult[]
): MappingValidationResult {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

function normalizeHubspotType(type: string | null | undefined): NormalizedFieldType {
  const value = (type ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "enumeration") return "enumeration";
  if (value === "bool" || value === "boolean") return "boolean";
  if (value === "datetime" || value === "date") return "datetime";
  if (value === "number") return "number";
  if (value === "string" || value === "text" || value === "phone") return "string";
  return "unknown";
}

function normalizeMindbodyType(type: string | null | undefined): NormalizedFieldType {
  const value = (type ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "boolean" || value === "bool") return "boolean";
  if (value.includes("date") || value.includes("time")) return "datetime";
  if (
    value === "number" ||
    value.includes("double") ||
    value.includes("int") ||
    value.includes("float") ||
    value.includes("decimal")
  ) {
    return "number";
  }
  if (value === "string" || value === "text") return "string";
  return "unknown";
}

export function validateHubspotWritable(
  hubspot: HubspotPropertyRef
): MappingValidationResult {
  if (!hubspot.readOnly) return emptyResult();
  return {
    ok: false,
    errors: [`HubSpot property "${hubspot.name}" is read-only and cannot be mapped.`],
    warnings: [],
  };
}

export function validateTypeCompatibility(
  hubspotType: string | null | undefined,
  mindbodyType: string | null | undefined
): MappingValidationResult {
  const hs = normalizeHubspotType(hubspotType);
  const mb = normalizeMindbodyType(mindbodyType);

  if (hs === "unknown" || mb === "unknown") {
    return {
      ok: true,
      errors: [],
      warnings: [
        "Could not verify type compatibility (missing or unknown property types).",
      ],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  switch (hs) {
    case "string":
      if (mb === "number" || mb === "boolean") {
        warnings.push(
          `Mindbody ${mb} values will be coerced to string for HubSpot.`
        );
      } else if (mb === "datetime") {
        warnings.push(
          "Mindbody datetime values will be formatted as strings for HubSpot."
        );
      } else if (mb !== "string") {
        errors.push(`Cannot map Mindbody ${mb} field to HubSpot string property.`);
      }
      break;
    case "number":
      if (mb === "string") {
        warnings.push(
          "Mindbody string values must be numeric to sync to HubSpot number properties."
        );
      } else if (mb !== "number") {
        errors.push(`Cannot map Mindbody ${mb} field to HubSpot number property.`);
      }
      break;
    case "datetime":
      if (mb !== "datetime") {
        errors.push(
          `Cannot map Mindbody ${mb} field to HubSpot date/datetime property.`
        );
      }
      break;
    case "enumeration":
      if (mb !== "string") {
        errors.push(
          `Cannot map Mindbody ${mb} field to HubSpot enumeration property (string values only).`
        );
      }
      break;
    case "boolean":
      if (mb === "string") {
        warnings.push(
          'Mindbody string values must be "true" or "false" for HubSpot boolean properties.'
        );
      } else if (mb !== "boolean") {
        errors.push(`Cannot map Mindbody ${mb} field to HubSpot boolean property.`);
      }
      break;
    default:
      break;
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateMappingPair(
  hubspot: HubspotPropertyRef,
  mindbody: MindbodyFieldRef
): MappingValidationResult {
  return mergeResults(
    validateHubspotWritable(hubspot),
    validateTypeCompatibility(hubspot.type, mindbody.type)
  );
}

export function validateSystemMappingsPreserved(
  before: MappingRowRef[],
  after: MappingRowRef[]
): MappingValidationResult {
  const errors: string[] = [];
  const afterByHubspot = new Map(
    after.map((row) => [row.hubspotProperty, row.mindbodyField])
  );

  for (const row of before) {
    if (!row.isSystem) continue;

    const nextMindbodyField = afterByHubspot.get(row.hubspotProperty);
    if (nextMindbodyField === undefined) {
      errors.push(
        `System mapping "${row.hubspotProperty}" ↔ "${row.mindbodyField}" cannot be removed.`
      );
      continue;
    }
    if (nextMindbodyField !== row.mindbodyField) {
      errors.push(
        `System mapping "${row.hubspotProperty}" must stay mapped to "${row.mindbodyField}".`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateDuplicateMindbodyTargets(
  mappings: MappingRowRef[]
): MappingValidationResult {
  const seen = new Map<string, string>();
  const errors: string[] = [];

  for (const row of mappings) {
    const existing = seen.get(row.mindbodyField);
    if (existing && existing !== row.hubspotProperty) {
      errors.push(
        `Mindbody field "${row.mindbodyField}" is mapped to both "${existing}" and "${row.hubspotProperty}".`
      );
    }
    seen.set(row.mindbodyField, row.hubspotProperty);
  }

  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateMappingBatch(
  mappings: MappingRowRef[],
  hubspotCatalog: HubspotPropertyRef[],
  mindbodyCatalog: MindbodyFieldRef[]
): MappingValidationResult {
  const hubspotByName = new Map(hubspotCatalog.map((p) => [p.name, p]));
  const mindbodyByKey = new Map(mindbodyCatalog.map((f) => [f.key, f]));
  const pairResults: MappingValidationResult[] = [
    validateDuplicateMindbodyTargets(mappings),
  ];

  for (const row of mappings) {
    const hubspot = hubspotByName.get(row.hubspotProperty);
    const mindbody = mindbodyByKey.get(row.mindbodyField);

    if (!hubspot) {
      pairResults.push({
        ok: false,
        errors: [`HubSpot property "${row.hubspotProperty}" was not found in the catalog.`],
        warnings: [],
      });
      continue;
    }
    if (!mindbody) {
      pairResults.push({
        ok: false,
        errors: [`Mindbody field "${row.mindbodyField}" was not found in the catalog.`],
        warnings: [],
      });
      continue;
    }

    pairResults.push(validateMappingPair(hubspot, mindbody));
  }

  return mergeResults(...pairResults);
}

export function validateContactMappingSave(
  before: MappingRowRef[],
  after: MappingRowRef[],
  hubspotCatalog: HubspotPropertyRef[],
  mindbodyCatalog: MindbodyFieldRef[]
): MappingValidationResult {
  return mergeResults(
    validateSystemMappingsPreserved(before, after),
    validateMappingBatch(after, hubspotCatalog, mindbodyCatalog)
  );
}

function assertResult(
  label: string,
  result: MappingValidationResult,
  expectOk: boolean
): void {
  if (result.ok !== expectOk) {
    throw new Error(
      `${label}: expected ok=${expectOk}, got ok=${result.ok} errors=${JSON.stringify(result.errors)} warnings=${JSON.stringify(result.warnings)}`
    );
  }
}

/** Dev self-check for step 2.2 — run with `npm run validate:mapping`. */
export function runValidateSelfCheck(): void {
  assertResult(
    "email ↔ Email",
    validateTypeCompatibility("string", "string"),
    true
  );
  assertResult(
    "firstname ↔ FirstName",
    validateTypeCompatibility("string", "string"),
    true
  );
  assertResult(
    "amount ↔ amount",
    validateTypeCompatibility("number", "number"),
    true
  );
  assertResult(
    "closedate ↔ contractStartDateTime",
    validateTypeCompatibility("datetime", "datetime"),
    true
  );
  assertResult(
    "deal_source enum ↔ string",
    validateTypeCompatibility("enumeration", "string"),
    true
  );
  assertResult(
    "enum ↔ number blocked",
    validateTypeCompatibility("enumeration", "number"),
    false
  );
  assertResult(
    "datetime ↔ string blocked",
    validateTypeCompatibility("datetime", "string"),
    false
  );
  assertResult(
    "number ↔ boolean blocked",
    validateTypeCompatibility("number", "boolean"),
    false
  );

  assertResult(
    "read-only HubSpot property",
    validateHubspotWritable({
      name: "hs_object_id",
      type: "number",
      readOnly: true,
    }),
    false
  );

  assertResult(
    "system mapping removal blocked",
    validateSystemMappingsPreserved(
      [{ hubspotProperty: "email", mindbodyField: "Email", isSystem: true }],
      []
    ),
    false
  );
  assertResult(
    "system mapping retarget blocked",
    validateSystemMappingsPreserved(
      [{ hubspotProperty: "email", mindbodyField: "Email", isSystem: true }],
      [{ hubspotProperty: "email", mindbodyField: "FirstName" }]
    ),
    false
  );
  assertResult(
    "system mapping preserved",
    validateSystemMappingsPreserved(
      [{ hubspotProperty: "email", mindbodyField: "Email", isSystem: true }],
      [{ hubspotProperty: "email", mindbodyField: "Email" }]
    ),
    true
  );

  const batch = validateMappingBatch(
    [
      { hubspotProperty: "email", mindbodyField: "Email" },
      { hubspotProperty: "firstname", mindbodyField: "FirstName" },
    ],
    [
      { name: "email", type: "string", readOnly: false },
      { name: "firstname", type: "string", readOnly: false },
    ],
    [
      { key: "Email", type: "string" },
      { key: "FirstName", type: "string" },
    ]
  );
  assertResult("batch good pairs", batch, true);
}
