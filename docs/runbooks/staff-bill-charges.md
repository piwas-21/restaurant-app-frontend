# Staff bill charges

Admins configure **Restaurant settings → Bill charges**. Service fee and delivery fee start disabled;
admins can define custom fields, choose a fixed/suggested amount, allow staff-entered amounts, and select
order types and Cashier/Server access. Staff opt into each charge when placing an order or collecting
payment. Disabled fields do not appear in staff flows. Only positive amounts are saved and printed.

A saved charge keeps its label, currency and amount even after configuration changes. Each key can be
added once per order. Original accepted order totals remain unchanged; payable totals, table balances,
collection and closing checks include the charge. Existing payment or amendment recovery must finish
before another charge can be added. External marketplace orders are excluded.

If a save response is lost, the collection view locks financial actions and offers **Check and save the
same charges**. It replays the original operation ID, version and payload, including after reloading the
page. Do not clear browser session storage to bypass this lock. Check the bill and outstanding payments
before starting another operation. A confirmed refusal refreshes the bill so staff can make a new choice.

## Printer rollout

Install printer app **1.0.37 or later** before enabling charge rules for a tenant using the native cashier
printer. Older versions accept the additive response but omit charge rows and print the original total.
Browser bills use the payable total. Kitchen receipts do not include bill charges. Publishing the app
or receiving a print acknowledgement does not confirm installation or physical paper output.

## Kitchen board

The board shows the tenant's current business day, newest orders first. Active work is the default;
completed/served work moves to Completed. The filter flyout provides search, status and order type.
Sound settings use the shared modal with backdrop/Escape dismissal and touch-aware repeat stopping.
Browsers may require the **Enable sound** action after opening the board.
