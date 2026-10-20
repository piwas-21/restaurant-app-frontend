# Staff bill adjustments

The admin Bill charges tab includes a disabled Discount preset and custom fields. Each
field specifies Increase/Reduce, Fixed/Percentage, allowed order types and staff roles,
and whether staff may enter a custom value. Staff must explicitly select a field.

Percentages use the selected order's retained item basis, excluding fees and tips. The
staff editor names that basis; table bills with multiple rounds retain the existing
round selector. Inputs stay nonnegative magnitudes. Accepted reductions display as
negative amounts on the ticket/browser bill and in the staff-discount report category.

Drafts retain the reviewed effect/calculation. If configuration changes those semantics,
the field must be removed and reselected. A pending request retains its original payload
for idempotent recovery. The server validates rules, versions, currency and financial
holds; previews use integer minor-unit percentage rounding but never replace its quote.

Discounts are applied before captured payments. Frozen-tax bills require tax reconciliation
before reductions or percentage adjustments. These blocks have visible/hover explanations;
ordinary fixed fees remain available where the existing billing workflow permits them.
Unresolved amendment corrections hold all bill-print destinations, including an already
open chooser. Current invoice amounts retain exact ordinal penny ownership.
Native cashier discount rendering requires printer app 1.0.40 or later; publishing that
version does not prove installation or physical paper output on a tenant's device.
