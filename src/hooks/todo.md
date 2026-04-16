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

offline/online notification is too slow in prod

server should broadcast taskcompleted if no response after 4 hours, so runner can be free


Welcome back there! Would you like to run a pickup or run an errand?
20:29
Run Errand
20:29
Got it! Your service type has been updated. Click "Connect to service" when ready.
 bad xxx - never assume it will always update, if bad network then show the error message 