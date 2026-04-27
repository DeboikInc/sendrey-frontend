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

- add the escrow refund history to runner/user wallet as case may be, let the wallet know someting happened, not just drop money and call it a day

- phone delivery to run errand
