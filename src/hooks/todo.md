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


message local keeping with marker and sending when network is back with marked

offline/online notification is too slow in prod
server should broadcast taskcompleted if no response after 4 hours, so runner can be free
