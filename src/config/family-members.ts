import { z } from "zod";
import { readFile } from "fs/promises";
import { parsePhoneNumber } from "libphonenumber-js";

/**
 * Family Member Schema
 *
 * Validates and normalizes family member data:
 * - Phone numbers are validated and converted to E.164 format
 * - Names are required and limited to 50 characters
 */
const FamilyMemberSchema = z.object({
  phone: z.string().transform((val, ctx) => {
    try {
      const parsed = parsePhoneNumber(val);
      if (!parsed.isValid()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid phone number: ${val}`,
        });
        return z.NEVER;
      }
      return parsed.format("E.164");
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid phone number format: ${val}`,
      });
      return z.NEVER;
    }
  }),
  name: z.string().min(1, "Name cannot be empty").max(50, "Name too long"),
  uuid: z.string().uuid().optional(),
});

/**
 * Family Configuration Schema
 *
 * Requires at least one family member
 */
const FamilyConfigSchema = z.object({
  members: z
    .array(FamilyMemberSchema)
    .min(1, "At least one family member required"),
});

export type FamilyMember = z.infer<typeof FamilyMemberSchema>;
export type FamilyConfig = z.infer<typeof FamilyConfigSchema>;

/**
 * Load and validate family member configuration from JSON file
 *
 * @param path - Path to the family-members.json file
 * @returns Validated family configuration
 * @throws Error if file not found or validation fails
 */
export async function loadFamilyConfig(
  path: string = "./family-members.json",
): Promise<FamilyConfig> {
  try {
    const fileContent = await readFile(path, "utf-8");
    const json = JSON.parse(fileContent);
    return FamilyConfigSchema.parse(json);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `Family configuration file not found at: ${path}\nPlease create it based on family-members.example.json`,
      );
    }
    throw error;
  }
}

/**
 * Family Whitelist
 *
 * Provides fast O(1) phone number lookup for family member access control.
 * Phone numbers are stored in E.164 format for consistent matching.
 */
export class FamilyWhitelist {
  private membersByPhone: Map<string, string>;
  private membersByUuid: Map<string, string>;

  constructor(config: FamilyConfig) {
    this.membersByPhone = new Map(config.members.map((m) => [m.phone, m.name]));
    this.membersByUuid = new Map(
      config.members.filter((m) => m.uuid).map((m) => [m.uuid!, m.name]),
    );
  }

  /**
   * Check if an identifier (phone number or UUID) is allowed
   */
  isAllowed(identifier: string): boolean {
    return (
      this.membersByPhone.has(identifier) || this.membersByUuid.has(identifier)
    );
  }

  /**
   * Get family member name by phone number or UUID
   */
  getName(identifier: string): string | undefined {
    return (
      this.membersByPhone.get(identifier) ?? this.membersByUuid.get(identifier)
    );
  }

  /**
   * Get total number of family members
   *
   * @returns Number of family members in whitelist
   */
  getMemberCount(): number {
    return this.members.size;
  }
}
