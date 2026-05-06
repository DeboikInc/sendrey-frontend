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

presenceHeartbeat — same, lossy by design, fine.

add runner to know reason for rejection

landing page merge

LedgerEntry validation failed: type: `escrow_refund` is not a valid enum value for path `type`.
