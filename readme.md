
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

