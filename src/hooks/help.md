
guard clicking accross all buttons
# npx cap sync after every npm run build
npx cap run android

socket.emit = private, socket.to() = broadcast minus me, io.to() = system announcement to the whole room.

<!-- production testing issues -->

2. add in progress message in crucial places and remove buttons/customInput until after response to prevent multiple sends e.g after servicetype in startnew order
, disable buttons after sending
3. usedpayoutsystem still reading false, not sure runnerchatscreen is actively reading payout emit, maybe it should poll for it, 
4. when i tried to cancel a new order, runnerchatscreen still thinks its been paid, the chatmanager and zustand probably arent clearing payment after prev order completed
5. my internet went off mid testing and when it came back, socket wont connect back, how do i know: i sent messages and the otehr person is not receiving the messages. i need high priority for this
6. i also want to optimize for low networks for both server and socket server
7. i want app to always resume back if it was in middle of an order(if app was in chatscreen before user/runner closed the app). it should resume back there with all messages intact(all messages they add before and flow should continue from the message). meaning chatmanager has to also save socket history for each order in memory and socket should connect back immediately