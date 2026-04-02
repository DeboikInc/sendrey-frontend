
guard clicking accross all buttons
# npx cap sync after every npm run build
npx cap run android

Server fetch in OrderStatusFlow — When the flow opens, it now emits getOrderByChatId to your socket server and reads the response directly. This gives it fresh coordinates and the canonical serviceType from the DB, bypassing all the stale prop chains. You'll need to handle getOrderByChatId on your server (emit back orderByChatId with the full order object) — if your server already has this, great; if not, the 4-second timeout falls back gracefully to props.



socket.emit = private, socket.to() = broadcast minus me, io.to() = system announcement to the whole room.