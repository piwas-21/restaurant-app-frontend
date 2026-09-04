export enum DiscountType {
  Percentage = 'Percentage',
  FixedAmount = 'FixedAmount',
}

export interface GroupDiscountDto {
  id: string;
  groupId: string;
  name: string;
  type: DiscountType;
  value: number;
  /**
   * `number | null`, not `number | undefined` (#642). `GroupDiscount.MinimumOrderAmount` and
   * `.MaximumDiscountAmount` are `decimal?` on the entity, on `GroupDiscountDto` and through the
   * 1:1 `UserGroupMapper` projection, and the API sets no `DefaultIgnoreCondition` — so an unset
   * cap is an explicit `null` on the wire, never an absent key.
   *
   * This type said `undefined`, `DiscountModal` mirrored it as `z.coerce.number().optional()`, and
   * that combination did not refuse the null — it COERCED it to 0. `null` here is what makes the
   * schema's `.nullish()` type-check as the honest reading of the response rather than as defence
   * against a shape the type says cannot happen.
   */
  minimumOrderAmount?: number | null;
  maximumDiscountAmount?: number | null;
  isActive: boolean;
}

export interface CreateGroupDiscountDto {
  name: string;
  type: DiscountType;
  value: number;
  minimumOrderAmount?: number | null;
  maximumDiscountAmount?: number | null;
}

export interface UpdateGroupDiscountDto {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minimumOrderAmount?: number | null;
  maximumDiscountAmount?: number | null;
  isActive: boolean;
}

export interface GroupMembershipDto {
  id: string;
  groupId: string;
  userId: string;
  userEmail: string;
  userName: string;
  uniqueQRCode: string;
  isActive: boolean;
  joinedAt: string;
  expiresAt?: string;
}

export interface AddMemberDto {
  userId: string;
  expiresAt?: string;
}

export interface UserGroupDto {
  id: string;
  name: string;
  /** Non-nullable on the wire — `UserGroupDto.Description` is `string` with `= string.Empty`. */
  description: string;
  qrCodeData: string;
  isActive: boolean;
  /**
   * `string | null` (#642): `ValidFrom`/`ValidUntil` are `DateTime?`, so an open-ended group sends
   * an explicit `null`. The audit in #642 filed these as non-nullable, which is true of
   * `description` alone — the DTO was read, the two dates beside it were not.
   */
  validFrom?: string | null;
  validUntil?: string | null;
  memberCount: number;
  discounts: GroupDiscountDto[];
}

export interface CreateUserGroupDto {
  name: string;
  description: string;
  validFrom?: string;
  validUntil?: string;
  initialDiscount?: CreateGroupDiscountDto;
}

export interface UpdateUserGroupDto {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface ValidateQRCodeDto {
  qrCode: string;
}

export interface QRCodeValidationResult {
  isValid: boolean;
  message: string;
  membership?: GroupMembershipDto;
  group?: UserGroupDto;
  applicableDiscounts: GroupDiscountDto[];
}

export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}
