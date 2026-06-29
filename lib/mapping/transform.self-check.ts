import {
  extractMindbodyValue,
  formatForHubspot,
  mapMindbodyFieldsToHubspot,
} from "./transform";

function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTruthy(label: string, value: unknown): void {
  if (!value) {
    throw new Error(`${label}: expected truthy value, got ${JSON.stringify(value)}`);
  }
}

const sampleClient: Record<string, unknown> = {
  Id: "100000001",
  Email: "jane@example.com",
  FirstName: "Jane",
  LastName: "Doe",
  MobilePhone: "555-0100",
  HomePhone: "555-0199",
  BirthDate: "1990-05-15T00:00:00",
  IsProspect: false,
  AccountBalance: 42.5,
  HomeLocation: { Id: 2, Name: "San Diego", SiteID: -99 },
  CustomClientFields: [{ Id: 3, Value: "VIP Member" }],
};

assertEqual(
  "flat Email",
  extractMindbodyValue(sampleClient, "Email"),
  "jane@example.com"
);
assertEqual(
  "nested HomeLocation.Id",
  extractMindbodyValue(sampleClient, "HomeLocation.Id"),
  2
);
assertEqual(
  "nested HomeLocation.Name",
  extractMindbodyValue(sampleClient, "HomeLocation.Name"),
  "San Diego"
);
assertEqual(
  "custom:3",
  extractMindbodyValue(sampleClient, "custom:3"),
  "VIP Member"
);
assertEqual(
  "missing custom field",
  extractMindbodyValue(sampleClient, "custom:99"),
  undefined
);
assertEqual(
  "missing nested path",
  extractMindbodyValue(sampleClient, "HomeLocation.Missing"),
  undefined
);

assertEqual(
  "format string",
  formatForHubspot("hello", "string", "string"),
  "hello"
);
assertEqual(
  "format number from number",
  formatForHubspot(42.5, "number", "number"),
  "42.5"
);
assertEqual(
  "format number from numeric string",
  formatForHubspot("12.5", "number", "string"),
  "12.5"
);
assertEqual(
  "format boolean false",
  formatForHubspot(false, "boolean", "boolean"),
  "false"
);
assertEqual(
  "format boolean from string",
  formatForHubspot("true", "boolean", "string"),
  "true"
);
assertTruthy(
  "format datetime",
  formatForHubspot("1990-05-15T00:00:00", "datetime", "datetime")
);
assertEqual(
  "format invalid number",
  formatForHubspot("not-a-number", "number", "string"),
  null
);

const mapped = mapMindbodyFieldsToHubspot(
  [
    {
      hubspot_property: "email",
      mindbody_field: "Email",
      hubspot_property_type: "string",
      mindbody_field_type: "string",
    },
    {
      hubspot_property: "firstname",
      mindbody_field: "FirstName",
      hubspot_property_type: "string",
      mindbody_field_type: "string",
    },
    {
      hubspot_property: "custom_notes",
      mindbody_field: "custom:3",
      hubspot_property_type: "string",
      mindbody_field_type: "string",
    },
    {
      hubspot_property: "home_location_id",
      mindbody_field: "HomeLocation.Id",
      hubspot_property_type: "number",
      mindbody_field_type: "number",
    },
    {
      hubspot_property: "is_prospect",
      mindbody_field: "IsProspect",
      hubspot_property_type: "boolean",
      mindbody_field_type: "boolean",
    },
  ],
  sampleClient
);

assertEqual("mapped email", mapped.email, "jane@example.com");
assertEqual("mapped firstname", mapped.firstname, "Jane");
assertEqual("mapped custom field", mapped.custom_notes, "VIP Member");
assertEqual("mapped nested number", mapped.home_location_id, "2");
assertEqual("mapped boolean", mapped.is_prospect, "false");

console.log("mapping transform self-check passed");
