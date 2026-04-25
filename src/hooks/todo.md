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
- streamlining remove serviceType onboarding, meaning user dont fetch by serviceType anymore, runner dont update anything when start new order is clicked > connect to errand straight. runner also dont serach with serviceType anymore. this is a very big refactor work omo

- usemessageque isnt ticking after sending, other tester even saw the textm the trick is to use pending if the other person hasnt received the message or theres a delay

- add the escrow refund history to runner/user wallet as case may be, let the wallet know someting happened, not just drop money and call it a day
