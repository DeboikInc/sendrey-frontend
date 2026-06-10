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

before we go live we need to upgrade these three services.
Upgrade Render to paid plan
Sort Cloudinary paid plan
MongoDB Atlas — make sure it's not on free tier either (512MB storage limit)

"runner misconduct costs us X in Paystack fees per ban, do we absorb or pass to user?


