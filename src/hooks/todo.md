# hotfix — work directly on dev, test it, push up the chain

git checkout dev
# fix the bug
git add .
git commit -m "fix: phone validation bug"

# works? push to staging
git checkout staging
git merge dev

# tested on staging? push to main
git checkout main
git merge staging

https://sendrey.netlify.app


- add browser notifications

- phone delivery to run errand

reactToMessage — in handleMessageReact, reactions are fire-and-forget with no queue. Low priority but worth noting.

deleteMessage — in handleDeleteMessage, same — if offline, delete is optimistic on client but never reaches server.

runner:locationUpdate — GPS location is emitted every few seconds. These are inherently lossy and that's fine, no need to queue.

presenceHeartbeat — same, lossy by design, fine.

