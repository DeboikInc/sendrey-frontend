Get all runners/users
search for a single runner/users
get runners/users statistics
get/edit runners/users status, e.g runner gets banned?
export users/runners 
delete a runners/users

Admin Business Actions
get all business suggestions
get all business statistics e.g people who converted, ppl who opted out
admin manual reset for opted out actions
admin get all business accounts(no detail. just name of business, members, admin name etc)
admin get a single business account by searching
admin manually convert an account to business account
admin revoke business account(maybe violation etc)

Admin Dispute Actions
admin get all disputes
admin get a single dispute 
admin resolve a dispute

Admin order Actions
admin get all orders, single order

Admin Payout Actions
admin get all runner payout to vendor receipts
admin get runners payout stats
admin get a single receipt


Error saving call log: Error: CallLog validation failed: callId: Path `callId` is required.
    at ValidationError.inspect (C:\Users\timiv\Desktop\sendrey-server\node_modules\mongoose\lib\error\validation.js:50:26)
    at formatValue (node:internal/util/inspect:848:19)
    at inspect (node:internal/util/inspect:386:10)
    at formatWithOptionsInternal (node:internal/util/inspect:2349:40)
    at formatWithOptions (node:internal/util/inspect:2211:10)
    at console.value (node:internal/console/constructor:338:14)
    at console.warn (node:internal/console/constructor:379:61)
    at Socket.<anonymous> (C:\Users\timiv\Desktop\sendrey-server\socket\callHandlers.js:257:15)   
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {
  errors: {
    callId: ValidatorError: Path `callId` is required.
        at validate (C:\Users\timiv\Desktop\sendrey-server\node_modules\mongoose\lib\schematype.js:1365:13)
        at SchemaType.doValidate (C:\Users\timiv\Desktop\sendrey-server\node_modules\mongoose\lib\schematype.js:1349:7)
        at C:\Users\timiv\Desktop\sendrey-server\node_modules\mongoose\lib\document.js:3004:18    
        at process.processTicksAndRejections (node:internal/process/task_queues:85:11) {
      properties: [Object],
      kind: 'required',
      path: 'callId',
      value: null,
      reason: undefined,
      [Symbol(mongoose:validatorError)]: true
    }
  },
  _message: 'CallLog validation failed'
}

stale serviceType

✅ Card payment verified | runner: ₦1562 | platform net: ₦2035 | paystack fee: ₦36
2026-03-23 09:07:38 [info]: Payment verified via socket for ref 656ivs5zs5
{
  "service": "sendrey-server",
  "environment": "development"
}
2026-03-23 09:07:38 [info]: 💰 Payment success received:
{
  "service": "sendrey-server",
  "environment": "development",
  "chatId": "user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8",
  "reference": "656ivs5zs5",
  "orderId": "ORD-MN2WHFHG-B0MD9"
}
2026-03-23 09:07:38 [info]: Order ORD-MN2WHFHG-B0MD9 already paid — skipping DB update but still notifying room
{
  "service": "sendrey-server",
  "environment": "development"
}
Room user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 has 2 sockets
2026-03-23 09:07:39 [info]: Room user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 has 2 sockets
{
  "service": "sendrey-server",
  "environment": "development"
}
2026-03-23 09:07:39 [info]: ✅ Payment confirmed for order ORD-MN2WHFHG-B0MD9, system message sent 
{
  "service": "sendrey-server",
  "environment": "development"
}
2026-03-23 09:07:40 [info]: RunnerPayout created for order ORD-MN2WHFHG-B0MD9 | itemBudget: ₦20000{
  "service": "sendrey-server",
  "environment": "development"
}
[payment]- change usedpayout to false line 163 paymnethandlers runner socket in room? user-69c0f2c  "environment": "development"
}
[payment]- change usedpayout to false line 163 paymnethandlers runner socket in room? user-69c0f2c}
[payment]- change usedpayout to false line 163 paymnethandlers runner socket in room? user-69c0f2c[payment]- change usedpayout to false line 163 paymnethandlers runner socket in room? user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 room size: 2
[payment] emitting paymentSuccess to room: user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 data: { escrowId: undefined, orderId: 'ORD-MN2WHFHG-B0MD9' }
[payment] emitting paymentSuccess to room: user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 data: { escrowId: undefined, orderId: 'ORD-MN2WHFHG-B0MD9' }
109cc8 data: { escrowId: undefined, orderId: 'ORD-MN2WHFHG-B0MD9' }
Room user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8 has 2 sockets: [ 'PIqyfKMyebf05p17AAAB', 'dq4t78UYZ_HnY1qsAAAD' ]
updateStatus received: {
  chatId: 'user-69c0f2ceafa46266a7109cf8-runner-69c0f22eafa46266a7109cc8',
  status: 'arrived_at_market',
  runnerId: '69c0f22eafa46266a7109cc8'
}
Resolved serviceType: pick-up (chat: pick-up , client: undefined )
Task type: pick-up
 Invalid status: arrived_at_market for task type: pick-up